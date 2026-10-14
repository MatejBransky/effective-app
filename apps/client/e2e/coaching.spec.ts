import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "local_dev_only";
const CLIENT = { username: "client-jan", password: PASSWORD };
const COACH = { username: "coach-maria", password: PASSWORD };

const ymd = (millis: number): string => new Date(millis).toISOString().slice(0, 10);

/** Full Keycloak round-trip: /coaching -> /login -> keycloak form -> home. */
const loginAs = async (browser: Browser, credentials: { username: string; password: string }) => {
  const context = await browser.newContext({ permissions: ["notifications"] });
  const page = await context.newPage();
  await page.goto("/coaching");
  await page.waitForURL(/.*:8180\/.*/);
  await page.locator("#username").fill(credentials.username);
  await page.locator("#password").fill(credentials.password);
  await page.locator("#kc-login").click();
  await page.waitForURL("http://localhost:5173/");

  return { context, page };
};

const sectionFor = (page: Page, name: string) => page.locator("section", { hasText: name }).first();

test("life-coaching flow works end to end", async ({ browser }) => {
  // --- Client: deterministic schedule (everything unlocked) ---
  const client = await loginAs(browser, CLIENT);
  await client.page.goto("/coaching/settings");
  const focus = new Date(Date.now() - 5 * 3600_000);
  const hh = String(focus.getUTCHours()).padStart(2, "0");
  const mm = String(focus.getUTCMinutes()).padStart(2, "0");
  await client.page.locator('input[type="time"]').fill(`${hh}:${mm}`);
  await client.page.locator("select").first().selectOption("UTC");
  // Pin English explicitly: a previous run's final leg persists locale=cs on
  // the profile, and the form initializes from it.
  await client.page.locator("select").nth(1).selectOption("en");
  await client.page.locator('form button[type="submit"]').click();
  await expect(client.page.getByText("Saved ✓")).toBeVisible();

  // --- Client: play all three audios for real, then submit each ---
  await client.page.goto("/coaching");

  for (const name of ["Daily Focus", "Recharge #1", "Recharge #2"]) {
    const section = sectionFor(client.page, name);
    await expect(section.locator("audio")).toHaveAttribute("src", /blob:/);
    await section.locator("audio").evaluate((audio: HTMLAudioElement) => audio.play());
    const submit = section.getByRole("button", { name: "Mark as listened" });
    await submit.click({ timeout: 30_000 });
    await expect(section.getByText("Listened ✓")).toBeVisible();
  }

  // --- Client: history replay of a past day ---
  await client.page.locator('input[type="date"]').fill(ymd(Date.now() - 86_400_000));

  for (const name of ["Daily Focus", "Recharge #1", "Recharge #2"]) {
    await expect(sectionFor(client.page, name)).toBeVisible();
  }

  // --- Coach: dashboard shows the client's listened state ---
  const coach = await loginAs(browser, COACH);
  await coach.page.goto("/coach");
  const row = coach.page.locator("tr", { hasText: "Jan Novak" });
  await expect(row).toBeVisible();
  // All three slots listened - strict count, not just presence.
  await expect(row.getByText("listened")).toHaveCount(3);
  await row.getByRole("link", { name: "Jan Novak" }).click();
  await expect(coach.page.getByText("listened").first()).toBeVisible();
  await expect(coach.page.getByText("listened")).toHaveCount(3);

  // --- Client: switch to Czech, UI follows ---
  await client.page.goto("/coaching/settings");
  await client.page.locator("select").nth(1).selectOption("cs");
  await client.page.locator('form button[type="submit"]').click();
  await expect(client.page.getByText("Uloženo ✓")).toBeVisible();
  await client.page.goto("/coaching");
  await expect(client.page.getByRole("heading", { name: "Dnes" })).toBeVisible();
  await expect(client.page.getByText("Poslechnuto ✓").first()).toBeVisible();

  await client.context.close();
  await coach.context.close();
});
