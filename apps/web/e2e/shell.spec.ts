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
  // Only the entry at the cursor renders - Menu's content is replaced by Details's, not
  // shown alongside it.
  await expect(panel).toContainText("Details");

  await panel.getByRole("button", { name: "Close" }).click();
  // Details closed, Menu (still on the history underneath) reappears unprompted.
  await expect(panel).toContainText("Menu");
});

test("Back/Forward navigate sidebar history without closing anything, showing target labels", async ({
  page,
}) => {
  await page.goto("/login");

  const backButton = page.getByRole("button", { name: "Back" });
  const forwardButton = page.getByRole("button", { name: "Forward" });
  await expect(backButton).toBeDisabled();
  await expect(forwardButton).toBeDisabled();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Details" }).click();
  const panel = page.getByTestId("sidebar-panel");
  await expect(panel).toContainText("Details");

  // Now positioned on Details, with Menu behind it - Back should say what it goes to.
  await expect(backButton).toHaveText("Back (Menu)");
  await expect(forwardButton).toBeDisabled();

  await backButton.click();
  await expect(panel).toContainText("Menu");
  // Details wasn't closed, just navigated away from - Forward reaches it again.
  await expect(forwardButton).toHaveText("Forward (Details)");

  await forwardButton.click();
  await expect(panel).toContainText("Details");
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

test("Close all sidebars clears the whole history, not just the current entry", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Details" }).click();
  const panel = page.getByTestId("sidebar-panel");
  await expect(panel).toContainText("Details");
  await expect(page.getByRole("button", { name: "Back" })).toHaveText("Back (Menu)");

  await page.getByRole("button", { name: "Close all sidebars" }).click();
  await expect(panel).not.toBeVisible();
  // Nothing left to navigate to either, in either direction.
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Forward" })).toBeDisabled();
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

test("Help opens temporarily on top of Delete's confirm dialog; closing it returns to Delete", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Delete this item?")).toBeVisible();

  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.getByText("Deleting removes the item everywhere.")).toBeVisible();
  await expect(page.getByText("Delete this item?")).not.toBeVisible();

  await page.getByRole("button", { name: "Got it" }).click();
  // Help closed (not replaced) - the confirm dialog underneath reappears unprompted.
  await expect(page.getByText("Delete this item?")).toBeVisible();
});

test("Notify (replaces) discards an open modal permanently - dismissing it reveals nothing", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Delete this item?")).toBeVisible();

  await page.getByRole("button", { name: "Notify (replaces)" }).click();
  await expect(page.getByText("New activity on this item.")).toBeVisible();
  // Delete's confirm dialog was discarded, not stacked underneath.
  await expect(page.getByText("Delete this item?")).not.toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  // Unlike Help, closing this does not bring anything back.
  await expect(page.getByText("Delete this item?")).not.toBeVisible();
  await expect(page.getByText("New activity on this item.")).not.toBeVisible();
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
