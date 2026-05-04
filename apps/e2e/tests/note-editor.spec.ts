import { test, expect } from "../fixtures/index";

test.describe("Note editor", () => {
  test("navigating to a note renders the TipTap editor", async ({ page, testNote }) => {
    await page.goto(`/notes/${testNote.id}`);
    await expect(page.locator(".ProseMirror, .tiptap").first()).toBeVisible({ timeout: 10_000 });
  });

  test("note title appears in the sidebar", async ({ page, testNote }) => {
    await page.goto(`/notes/${testNote.id}`);
    await expect(page.locator(`text="${testNote.title}"`).first()).toBeVisible();
  });
});
