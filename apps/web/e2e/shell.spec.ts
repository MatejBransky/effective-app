import { expect, test } from "@playwright/test";

// Proves the ShellUI/ShellHost/useShellUI round trip works end to end: SubscriptionRef
// push on open, Effect.callback resume + entry removal on resolve. The Navbar's "Menu"
// button is scaffolding only (see apps/web/src/components/Navbar.tsx) - it exists purely
// to exercise this wiring before a first real domain consumer replaces it.
test("Menu opens a sidebar via ShellUI, Close resolves and removes it", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const closeButton = page.getByRole("button", { name: "Close" });
  await expect(closeButton).toBeVisible();

  await closeButton.click();
  await expect(closeButton).not.toBeVisible();
});
