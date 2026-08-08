import { test, expect } from "../fixtures/index";

test.describe("Quick Notes page", () => {
  test("page loads with Quick Notes heading", async ({ page }) => {
    await page.goto("/quick-notes");
    await expect(page.getByRole("heading", { name: "Quick Notes" })).toBeVisible();
  });

  test("seeded quick notes appear as cards", async ({ page }) => {
    await page.goto("/quick-notes");
    await expect(page.locator(".mantine-Card-root").first()).toBeVisible({ timeout: 8_000 });
  });

  test("New button creates a note and increments count", async ({ page }) => {
    await page.goto("/quick-notes");

    // Wait for the seeded cards before counting. Reading the count straight after goto
    // raced the initial render, so initialCount was often 0 and the assertion compared
    // against 1 while the real total was 7.
    const cards = page.locator(".mantine-Card-root");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await cards.count();

    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(cards).toHaveCount(initialCount + 1);
  });

  test("search filters by title", async ({ page, quickNote }) => {
    await page.goto("/quick-notes");
    await page.getByPlaceholder("Search quick notes…").fill(quickNote.title);
    await expect(page.locator(".mantine-Card-root")).toHaveCount(1, { timeout: 5_000 });
  });
});
