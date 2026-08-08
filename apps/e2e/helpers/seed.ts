import fs from "fs/promises";
import path from "path";
import * as api from "./api";

const SEED_MANIFEST = path.resolve(__dirname, "../.seed-manifest.json");

interface Manifest {
  vaultId: string;
  folderIds: string[];
  noteIds: string[];
}

export async function seedDocsData(): Promise<void> {
  // Seed into the account's primary vault rather than a dedicated one. The web app selects
  // the first vault on load, so fixtures parked in a separate vault were invisible to every
  // test — which is part of why this suite had quietly stopped proving anything.
  const vaultId = await api.getPrimaryVaultId();
  const vault = { id: vaultId };
  const folderDev = await api.createFolder("Development", vault.id);
  const folderIdeas = await api.createFolder("Ideas", vault.id);
  const note1 = await api.createNote({
    title: "Architecture Notes",
    type: "note",
    vaultId: vault.id,
    folderId: folderDev.id,
  });
  const note2 = await api.createNote({
    title: "API Design",
    type: "note",
    vaultId: vault.id,
    folderId: folderDev.id,
  });
  const note3 = await api.createNote({
    title: "Feature Ideas",
    type: "note",
    vaultId: vault.id,
    folderId: folderIdeas.id,
  });
  const qn1 = await api.createNote({ title: "First quick note", type: "quick", vaultId: vault.id });
  const qn2 = await api.createNote({
    title: "Second quick note",
    type: "quick",
    vaultId: vault.id,
  });
  const qn3 = await api.createNote({ title: "Third quick note", type: "quick", vaultId: vault.id });

  const manifest: Manifest = {
    vaultId: vault.id,
    folderIds: [folderDev.id, folderIdeas.id],
    noteIds: [note1.id, note2.id, note3.id, qn1.id, qn2.id, qn3.id],
  };
  await fs.writeFile(SEED_MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`[seed] Seeded vault ${vault.id} with 3 notes and 3 quick notes`);
}

export async function teardownDocsData(): Promise<void> {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await fs.readFile(SEED_MANIFEST, "utf-8")) as Manifest;
  } catch {
    return;
  }
  for (const id of manifest.noteIds) {
    try {
      await api.deleteNote(id);
    } catch {}
  }
  for (const id of manifest.folderIds) {
    try {
      await api.deleteFolder(id);
    } catch {}
  }
  try {
    await api.deleteVault(manifest.vaultId);
  } catch {}
  await fs.unlink(SEED_MANIFEST).catch(() => undefined);
  console.log("[seed] Cleaned up E2E Docs Vault");
}
