import { test as base } from "@playwright/test";
import * as api from "../helpers/api";
import fs from "fs";
import path from "path";

/**
 * The seed manifest is written by global-setup. A vault is required now that notes cannot
 * exist outside one, so a missing manifest is a setup failure rather than something to
 * paper over with `undefined` — which previously produced a confusing 400 from the API
 * instead of naming the real problem.
 */
function getSeededVaultId(): string {
  const manifestPath = path.resolve(__dirname, "../.seed-manifest.json");
  let manifest: { vaultId?: string };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { vaultId?: string };
  } catch {
    throw new Error(`No seed manifest at ${manifestPath} — did global-setup run?`);
  }
  if (!manifest.vaultId) throw new Error("Seed manifest has no vaultId");
  return manifest.vaultId;
}

interface MyFixtures {
  testNote: api.Note;
  quickNote: api.Note;
}

export const test = base.extend<MyFixtures>({
  /**
   * Signs the browser in before any navigation.
   *
   * The web app gates every real route behind `_authenticated`, which reads the token from
   * localStorage — so without this every test landed on /login and asserted against an
   * empty page. That has been true since auth was introduced and went unnoticed because
   * the suite ran nowhere.
   */
  page: async ({ page }, use) => {
    const { token, user } = await api.getSession();
    await page.addInitScript(
      ([t, u]) => {
        window.localStorage.setItem("nodeira_token", t as string);
        window.localStorage.setItem("nodeira_user", JSON.stringify(u));
      },
      [token, user] as const,
    );
    await use(page);
  },

  testNote: async ({}, use) => {
    const note = await api.createNote({
      title: `Test Note ${Date.now()}`,
      type: "note",
      vaultId: getSeededVaultId(),
    });
    await use(note);
    await api.deleteNote(note.id).catch(() => undefined);
  },

  quickNote: async ({}, use) => {
    const note = await api.createNote({
      title: `Test Quick Note ${Date.now()}`,
      type: "quick",
      vaultId: getSeededVaultId(),
    });
    await use(note);
    await api.deleteNote(note.id).catch(() => undefined);
  },
});

export { expect } from "@playwright/test";
