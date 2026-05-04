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
    const initialCount = await page.locator(".mantine-Card-root").count();
    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.locator(".mantine-Card-root")).toHaveCount(initialCount + 1);
  });

  test("search filters by title", async ({ page, quickNote }) => {
    await page.goto("/quick-notes");
    await page.getByPlaceholder("Search quick notes…").fill(quickNote.title);
    await expect(page.locator(".mantine-Card-root")).toHaveCount(1, { timeout: 5_000 });
  });
});
