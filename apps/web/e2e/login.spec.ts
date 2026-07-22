import { expect, test } from "@playwright/test";

// Baseline smoke test - no live Keycloak/Docker infra needed, just proves the
// Playwright harness itself works end-to-end against a real Vite dev server.
test("login page renders the Keycloak login button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Log in with Keycloak" })).toBeVisible();
});

// Proves RegistryProvider + the __root.tsx navbar mount didn't break the login route.
test("navbar renders on the login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Effective")).toBeVisible();
});
