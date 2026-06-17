import Database from "better-sqlite3";
import path from "path";
import type { NoteMetadata } from "@nodeira/shared-types";

let db: Database.Database | null = null;

export function openDatabase(userDataPath: string): void {
  db = new Database(path.join(userDataPath, "nodeira.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS yjs_state (
      note_id TEXT PRIMARY KEY,
      state    BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_metadata (
      note_id    TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      type       TEXT NOT NULL DEFAULT 'note',
      kind       TEXT,
      kind_meta  TEXT,
      vault_id   TEXT,
      folder_id  TEXT,
      pinned     INTEGER NOT NULL DEFAULT 0,
      icon       TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      tags       TEXT
    );

    CREATE TABLE IF NOT EXISTS plugin_cache (
      plugin_id TEXT PRIMARY KEY,
      source    TEXT NOT NULL,
      bundle    TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrate older databases that predate the tags column (CREATE TABLE
  // IF NOT EXISTS won't add it). SQLite throws if the column already exists.
  try {
    db.exec("ALTER TABLE note_metadata ADD COLUMN tags TEXT");
  } catch {
    /* column already exists */
  }
}

// ── Yjs state ────────────────────────────────────────────────────────────────

export function loadYjsState(noteId: string): Uint8Array | null {
  if (!db) return null;
  const row = db.prepare("SELECT state FROM yjs_state WHERE note_id = ?").get(noteId) as
    | { state: Buffer }
    | undefined;
  return row ? new Uint8Array(row.state) : null;
}

export function saveYjsState(noteId: string, state: Uint8Array): void {
  if (!db) return;
  db.prepare("INSERT OR REPLACE INTO yjs_state (note_id, state, updated_at) VALUES (?, ?, ?)").run(
    noteId,
    Buffer.from(state),
    Date.now(),
  );
}

// ── Note metadata ────────────────────────────────────────────────────────────

type NoteMetadataRow = {
  note_id: string;
  title: string;
  type: string;
  kind: string | null;
  kind_meta: string | null;
  vault_id: string | null;
  folder_id: string | null;
  pinned: number;
  icon: string | null;
  created_at: number;
  updated_at: number;
  position: number;
  tags: string | null;
};

export function loadNoteMetadata(): NoteMetadata[] {
  if (!db) return [];
  const rows = db
    .prepare("SELECT * FROM note_metadata ORDER BY position")
    .all() as NoteMetadataRow[];
  return rows.map(rowToMetadata);
}

export function upsertNoteMetadata(notes: NoteMetadata[]): void {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO note_metadata
      (note_id, title, type, kind, kind_meta, vault_id, folder_id, pinned, icon, created_at, updated_at, position, tags)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((items: NoteMetadata[]) => {
    for (const n of items) {
      stmt.run(
        n.id,
        n.title,
        n.type,
        n.kind ?? null,
        n.kindMeta ? JSON.stringify(n.kindMeta) : null,
        n.vaultId ?? null,
        n.folderId ?? null,
        n.pinned ? 1 : 0,
        n.icon ?? null,
        n.createdAt.getTime(),
        n.updatedAt.getTime(),
        n.position,
        JSON.stringify(n.tags ?? []),
      );
    }
  });
  tx(notes);
}

function rowToMetadata(row: NoteMetadataRow): NoteMetadata {
  return {
    id: row.note_id,
    title: row.title,
    type: row.type as NoteMetadata["type"],
    kind: row.kind,
    kindMeta: row.kind_meta ? (JSON.parse(row.kind_meta) as Record<string, unknown>) : null,
    vaultId: row.vault_id,
    folderId: row.folder_id,
    pinned: row.pinned === 1,
    icon: row.icon,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    position: row.position,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
  };
}

// ── Plugin cache ─────────────────────────────────────────────────────────────

function pluginIdFromSource(source: string): string {
  const atIdx = source.lastIndexOf("@");
  const repoPath = atIdx > 0 ? source.slice(0, atIdx) : source;
  const slashIdx = repoPath.lastIndexOf("/");
  return slashIdx >= 0 ? repoPath.slice(slashIdx + 1) : repoPath;
}

export function getCachedBundle(source: string): string | null {
  if (!db) return null;
  const pluginId = pluginIdFromSource(source);
  const row = db.prepare("SELECT bundle FROM plugin_cache WHERE plugin_id = ?").get(pluginId) as
    | { bundle: string }
    | undefined;
  return row?.bundle ?? null;
}

export function setCachedBundle(source: string, bundle: string): void {
  if (!db) return;
  const pluginId = pluginIdFromSource(source);
  db.prepare(
    "INSERT OR REPLACE INTO plugin_cache (plugin_id, source, bundle, cached_at) VALUES (?, ?, ?, ?)",
  ).run(pluginId, source, bundle, Date.now());
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  if (!db) return null;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  if (!db) return;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
