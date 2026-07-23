import { expect, test } from "@playwright/test";

// Proves SidebarService/ModalService round-trip end to end: SubscriptionRef push on
// open, Effect.callback resume + entry removal on resolve. The Navbar's buttons are
// scaffolding only (see apps/web/src/components/Navbar.tsx) - they exist purely to
// exercise this wiring before a first real domain consumer replaces them.

test("Menu opens a sidebar via SidebarService, Close resolves and removes it", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const panel = page.getByTestId("sidebar-panel");
  await expect(panel).toContainText("Menu");

  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).not.toBeVisible();
});

test("Details opens on top of Menu; closing it reveals Menu again", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const panel = page.getByTestId("sidebar-panel");
  await expect(panel).toContainText("Menu");

  await page.getByRole("button", { name: "Details" }).click();
  // Only the top-of-stack entry renders - Menu's content is replaced by Details's, not
  // shown alongside it.
  await expect(panel).toContainText("Details");

  await panel.getByRole("button", { name: "Close" }).click();
  // Details closed, Menu (still on the stack underneath) reappears unprompted.
  await expect(panel).toContainText("Menu");
});

test("Close sidebar closes whichever sidebar is open, from outside its own content", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const panel = page.getByTestId("sidebar-panel");
  await expect(panel).toContainText("Menu");

  await page.getByRole("button", { name: "Close sidebar" }).click();
  await expect(panel).not.toBeVisible();
});

test("Delete opens a modal via ModalService and resolves to the chosen non-boolean result", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Delete" }).click();
  const archiveButton = page.getByRole("button", { name: "Archive instead" });
  await expect(archiveButton).toBeVisible();

  await archiveButton.click();
  await expect(archiveButton).not.toBeVisible();
  await expect(page.getByTestId("last-choice")).toHaveText("archive");
});

test("Ask question runs a plain Effect action (yield* ModalService) that resolves to the user's answer", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Ask question" }).click();
  const dontKnowButton = page.getByRole("button", { name: "I don't know" });
  await expect(dontKnowButton).toBeVisible();

  await dontKnowButton.click();
  await expect(dontKnowButton).not.toBeVisible();
  await expect(page.getByTestId("last-answer")).toHaveText("dontKnow");
});
