import { expect, request, test, type Browser } from "@playwright/test";

const PASSWORD = "local_dev_only";
const CLIENT = { username: "client-jan", password: PASSWORD };
const ADMIN = { username: "coach-admin", password: PASSWORD };

// Valid P-256/auth keys (generated once with node:crypto) so the server's
// web-push encryption builds a real payload - delivery then fails only at the
// network layer (unresolvable mock host), exercising the graceful path.
const MOCK_P256DH =
  "BNkOaRQVMlHYOVEvCRo3SYIyFqGAzaPWNUAongExu00ZlQl6PopBN43zMwT2CoRrUHJfm7yxuEcdxxI-JEIli_I";

const MOCK_AUTH = "zCh1jZ7h-Y7PoAMJEyn4HQ";
const MOCK_ENDPOINT = "https://push.example.test/sub-e2e";

/**
 * Push leg of the life-coaching flow. `PushManager.subscribe` is stubbed:
 * headless Chromium has no Push API in Playwright's incognito contexts and
 * Firefox cannot reach its push service from here
 * (microsoft/playwright#23954) - a real `subscribe()` cannot succeed in E2E.
 * Everything else is real: permission flow, service worker, the subscription
 * API, the scheduler, and web-push encryption up to the network send, which
 * fails gracefully (no delivery recorded, `{ sent: 0 }`). Real delivery is
 * covered by the `pushCheckDue` unit test (working sender) plus a one-time
 * manual check in a headed browser.
 */
test("push subscribe + scheduler wiring works end to end", async ({ browser }) => {
  const loginAs = async (runner: Browser, credentials: { username: string; password: string }) => {
    const context = await runner.newContext({ permissions: ["notifications"] });
    await context.addInitScript(
      ({ endpoint, p256dh, auth }) => {
        window.PushManager.prototype.subscribe = async function () {
          const subscription: PushSubscription = {
            endpoint,
            expirationTime: null,
            options: { userVisibleOnly: true, applicationServerKey: new Uint8Array(65).buffer },
            getKey: () => null,
            toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
            unsubscribe: async () => true,
          };

          return subscription;
        };
      },
      { endpoint: MOCK_ENDPOINT, p256dh: MOCK_P256DH, auth: MOCK_AUTH },
    );
    const page = await context.newPage();
    await page.goto("/coaching");
    await page.waitForURL(/.*:8180\/.*/);
    await page.locator("#username").fill(credentials.username);
    await page.locator("#password").fill(credentials.password);
    await page.locator("#kc-login").click();
    await page.waitForURL("http://localhost:5173/");

    return { context, page };
  };

  const client = await loginAs(browser, CLIENT);
  await client.page.goto("/coaching/settings");
  const focus = new Date(Date.now() - 5 * 3600_000);
  const hh = String(focus.getUTCHours()).padStart(2, "0");
  const mm = String(focus.getUTCMinutes()).padStart(2, "0");
  await client.page.locator('input[type="time"]').fill(`${hh}:${mm}`);
  await client.page.locator("select").first().selectOption("UTC");
  // Pin English explicitly: a previous run's profile may persist locale=cs,
  // and the form initializes from it.
  await client.page.locator("select").nth(1).selectOption("en");
  await client.page.locator('form button[type="submit"]').click();
  await expect(client.page.getByText("Saved ✓")).toBeVisible();

  await client.page.getByRole("button", { name: "Enable notifications" }).click();
  await expect(client.page.getByText("(on)")).toBeVisible({ timeout: 30_000 });

  const api = await request.newContext();

  // SAFETY: the OIDC password-grant token endpoint returns JSON with `access_token` on
  // success; the test fails on the subsequent 401 if the shape is wrong.
  const token = await api
    .post("http://localhost:8180/realms/effective-app/protocol/openid-connect/token", {
      form: { grant_type: "password", client_id: "effective-app-client", ...ADMIN },
    })
    .then((res) => res.json())
    .then((json) => (json as { access_token: string }).access_token);

  const headers = { Authorization: `Bearer ${token}` };
  const first = await api.post("http://localhost:4000/coaching/push/check-due", { headers });
  expect(first.ok()).toBe(true);
  // The mock endpoint cannot resolve, so every send fails gracefully: nothing
  // is recorded as delivered, and the scheduler reports zero.
  // SAFETY: `/coaching/push/check-due` returns `{ sent: number }` by contract (CoachingApi);
  // a shape change fails the toEqual below, not silently.
  expect((await first.json()) as { sent: number }).toEqual({ sent: 0 });
  const second = await api.post("http://localhost:4000/coaching/push/check-due", { headers });
  // SAFETY: same contract as above.
  expect((await second.json()) as { sent: number }).toEqual({ sent: 0 });
  await api.dispose();
  await client.context.close();
});
