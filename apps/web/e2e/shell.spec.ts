import { expect, test } from "@playwright/test";

// Proves SidebarService/ModalService round-trip end to end: SubscriptionRef push on
// open, Effect.callback resume + entry removal on resolve. The Navbar's Menu/Delete
// buttons are scaffolding only (see apps/web/src/components/Navbar.tsx) - they exist
// purely to exercise this wiring before a first real domain consumer replaces them.

test("Menu opens a sidebar via SidebarService, Close resolves and removes it", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Menu" }).click();
  const closeButton = page.getByRole("button", { name: "Close" });
  await expect(closeButton).toBeVisible();

  await closeButton.click();
  await expect(closeButton).not.toBeVisible();
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
