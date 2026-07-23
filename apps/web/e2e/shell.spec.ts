import { expect, test } from "@playwright/test";

// Proves SidebarService/ModalService round-trip end to end: SubscriptionRef push on
// open, Effect.callback resume + entry removal on resolve. The Navbar's buttons and
// <SidebarHost/>'s own toolbar (Back/Forward/label/Minimize/Close) are scaffolding only
// (see apps/web/src/components/Navbar.tsx) - they exist purely to exercise this wiring
// before a first real domain consumer replaces them.

test("Menu opens a sidebar via SidebarService, Close resolves and removes it", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const toolbar = page.getByTestId("sidebar-toolbar");
  await expect(page.getByTestId("sidebar-label")).toHaveText("Menu");

  await toolbar.getByRole("button", { name: "Close" }).click();
  await expect(toolbar).not.toBeVisible();
});

test("Details opens on top of Menu; closing it reveals Menu again", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const label = page.getByTestId("sidebar-label");
  await expect(label).toHaveText("Menu");

  await page.getByRole("button", { name: "Details" }).click();
  // Only the entry at the cursor renders - Menu's content is replaced by Details's, not
  // shown alongside it.
  await expect(label).toHaveText("Details");

  await page.getByTestId("sidebar-toolbar").getByRole("button", { name: "Close" }).click();
  // Details closed, Menu (still on the history underneath) reappears unprompted.
  await expect(label).toHaveText("Menu");
});

test("Re-opening the already-active sidebar (same key) replaces it in place, no duplicate history stop", async ({
  page,
}) => {
  await page.goto("/login");

  // Menu clicked twice in a row - both opens carry key: "menu", so the second must not
  // push a duplicate "Menu" entry behind the first.
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByTestId("sidebar-label")).toHaveText("Menu");
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
});

test("Menu -> Details -> Menu again lands on the single Menu entry, not a second copy", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByTestId("sidebar-label")).toHaveText("Details");

  // Re-opening "menu" navigates back to the existing entry - Details (ahead of it) is
  // discarded - rather than pushing a second, indistinguishable "Menu" past Details. The
  // Navbar's plain "Menu" button is name-ambiguous with the toolbar's "Back (Menu)" once
  // that's showing, hence `exact: true`.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByTestId("sidebar-label")).toHaveText("Menu");
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Forward" })).toBeDisabled();
});

test("Back/Forward navigate sidebar history without closing anything, showing target labels", async ({
  page,
}) => {
  await page.goto("/login");

  const backButton = page.getByRole("button", { name: "Back" });
  const forwardButton = page.getByRole("button", { name: "Forward" });
  await expect(backButton).not.toBeVisible();
  await expect(forwardButton).not.toBeVisible();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Details" }).click();
  const label = page.getByTestId("sidebar-label");
  await expect(label).toHaveText("Details");

  // Now positioned on Details, with Menu behind it - Back should say what it goes to.
  await expect(backButton).toHaveText("Back (Menu)");
  await expect(forwardButton).toBeDisabled();

  await backButton.click();
  await expect(label).toHaveText("Menu");
  // Details wasn't closed, just navigated away from - Forward reaches it again.
  await expect(forwardButton).toHaveText("Forward (Details)");

  await forwardButton.click();
  await expect(label).toHaveText("Details");
});

test("Minimize collapses the sidebar without closing it - content stays mounted", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const content = page.getByTestId("sidebar-content");
  await expect(content).toBeVisible();

  await page.getByRole("button", { name: "Minimize" }).click();
  // Minimized swaps in a completely different, minimal chrome (just Expand) - the
  // toolbar/label aren't rendered at all while collapsed, not just visually hidden.
  await expect(content).not.toBeVisible();
  await expect(page.getByTestId("sidebar-toolbar")).not.toBeVisible();
  const expandButton = page.getByRole("button", { name: "Expand" });
  await expect(expandButton).toBeVisible();

  await expandButton.click();
  await expect(content).toBeVisible();
  await expect(page.getByTestId("sidebar-label")).toHaveText("Menu");
});

test("Close all sidebars clears the whole history, not just the current entry", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByTestId("sidebar-label")).toHaveText("Details");
  await expect(page.getByRole("button", { name: "Back" })).toHaveText("Back (Menu)");

  await page.getByRole("button", { name: "Close all sidebars" }).click();
  await expect(page.getByTestId("sidebar-toolbar")).not.toBeVisible();
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

  // Triggered from a button *inside* Delete's own dialog, not the Navbar - once a modal's
  // backdrop is up it correctly blocks clicks to anything behind it (real modal
  // semantics), so a realistic "something external replaces this" trigger can't be a
  // covered Navbar button; it has to run from inside, same as Help does above.
  await page.getByRole("button", { name: "Simulate notification" }).click();
  await expect(page.getByText("New activity on this item.")).toBeVisible();
  // Delete's confirm dialog was discarded, not stacked underneath.
  await expect(page.getByText("Delete this item?")).not.toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  // Unlike Help, closing this does not bring anything back.
  await expect(page.getByText("Delete this item?")).not.toBeVisible();
  await expect(page.getByText("New activity on this item.")).not.toBeVisible();
});

test("Navbar's Notify (replaces) opens the same modal from a clean slate", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Notify (replaces)" }).click();
  await expect(page.getByText("New activity on this item.")).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
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
