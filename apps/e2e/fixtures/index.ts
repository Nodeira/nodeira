import { test as base } from "@playwright/test";
import * as api from "../helpers/api";
import fs from "fs";
import path from "path";

function getSeededVaultId(): string | undefined {
  try {
    const m = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../.seed-manifest.json"), "utf-8"),
    ) as { vaultId: string };
    return m.vaultId;
  } catch {
    return undefined;
  }
}

interface MyFixtures {
  testNote: api.Note;
  quickNote: api.Note;
}

export const test = base.extend<MyFixtures>({
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
