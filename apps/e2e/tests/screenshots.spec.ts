import { test } from "../fixtures/index";
import { SCREENSHOTS_DIR } from "../helpers/paths";
import path from "path";
import fs from "fs";
import type { Page } from "@playwright/test";

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

async function typeIntoEditor(page: Page, lines: string[]) {
  const editor = page.locator(".ProseMirror, .tiptap").first();
  await editor.click();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line !== "") {
      await page.keyboard.type(line);
    }
    if (i < lines.length - 1) {
      await page.keyboard.press("Enter");
    }
  }
  await page.waitForTimeout(600);
}

const NOTE_CONTENT = [
  "# Architecture Notes",
  "Core design decisions for the Nodeira sync layer.",
  "## Offline-First Sync",
  "Every note is a Yjs CRDT document. Changes made offline are stored in y-indexeddb and merged on reconnect.",
  "- y-indexeddb persists state locally — survives browser refresh",
  "- Hocuspocus WebSocket server stores Yjs snapshots in PostgreSQL",
  "- No conflict resolution code — Yjs handles all merges automatically",
  "## Why CRDTs?",
  "Traditional OT requires a central coordinator. CRDTs are commutative, so any order of merge produces the same result. This makes offline-first trivial.",
];

const QUICK_NOTE_CONTENT = [
  "Remember to document the Yjs sync architecture before the next sprint. The offline-first design is the core differentiator.",
  "Graph view ideas: force-directed layout, cluster nodes by folder, color nodes by last-modified date.",
  "Investigate tRPC for end-to-end type safety. Could replace the manual shared-types package with inferred router types.",
];

test.describe("Documentation screenshots", () => {
  test("quick-notes page", async ({ page }) => {
    await page.goto("/quick-notes");
    await page.locator(".mantine-Card-root").first().waitFor({ timeout: 8_000 });

    const cards = page.locator(".mantine-Card-root");
    const count = await cards.count();

    for (let i = 0; i < Math.min(count, QUICK_NOTE_CONTENT.length); i++) {
      const card = cards.nth(i);
      await card.click();
      await card.locator(".ProseMirror").waitFor({ timeout: 4_000 });
      await page.keyboard.type(QUICK_NOTE_CONTENT[i] ?? "");
      await page.waitForTimeout(200);
      // Collapse by clicking outside the card grid
      await page.locator("h3").first().click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "quick-notes.png") });
  });

  test("note editor", async ({ page }) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../.seed-manifest.json"), "utf-8"),
    ) as { noteIds: string[] };
    await page.goto(`/notes/${manifest.noteIds[0]}`);
    await page.locator(".ProseMirror, .tiptap").first().waitFor({ timeout: 10_000 });
    await typeIntoEditor(page, NOTE_CONTENT);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "note-editor.png") });
  });

  test("settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "settings.png") });
  });
});
