import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { authStorage } from "../lib/authStorage.js";
import { getSyncWsUrl } from "../lib/serverConfig.js";
import "../lib/electronAPI.js";

export interface YjsContext {
  doc: Y.Doc;
  wsProvider: HocuspocusProvider;
  idbProvider: IndexeddbPersistence | null;
}

interface CacheEntry {
  ctx: YjsContext;
  /** Number of live holders. The entry is torn down when this reaches zero. */
  refs: number;
  /** Cancels any pending desktop save timer. No-op on web. */
  cancelPendingSave: () => void;
}

/**
 * Module-level cache: one Yjs doc + providers per noteId.
 *
 * Stored at module scope (not React state) so that:
 * - Docs survive React re-renders and route transitions without reconnecting
 * - Multiple components can share the same doc (editor, status indicator, etc.)
 * - WebSocket connections are not torn down on every render
 *
 * Entries are refcounted. Previously the only caller that released anything was
 * NoteEditor; the quick-notes grid acquired one context per card and never released
 * any, so visiting /quick-notes opened a WebSocket, a Y.Doc and an IndexedDB handle
 * per card that stayed open for the lifetime of the page.
 */
const docCache = new Map<string, CacheEntry>();

// Teardown is deferred briefly so that:
// - React StrictMode's mount→unmount→remount in dev doesn't tear down the
//   WebSocket mid-handshake (which logs "closed before established")
// - Rapid back-and-forth navigation between two notes reuses the same provider
const pendingDestroys = new Map<string, ReturnType<typeof setTimeout>>();
const DESTROY_GRACE_MS = 250;

function cancelPendingDestroy(noteId: string) {
  const pending = pendingDestroys.get(noteId);
  if (pending) {
    clearTimeout(pending);
    pendingDestroys.delete(noteId);
  }
}

function teardown(noteId: string, entry: CacheEntry) {
  // Must run before doc.destroy(): the desktop save path holds a debounced timer
  // that would otherwise fire against a destroyed doc and call encodeStateAsUpdate
  // on it.
  entry.cancelPendingSave();
  entry.ctx.wsProvider.destroy();
  entry.ctx.idbProvider?.destroy();
  entry.ctx.doc.destroy();
  docCache.delete(noteId);
}

function createEntry(noteId: string): CacheEntry {
  const doc = new Y.Doc();

  let idbProvider: IndexeddbPersistence | null = null;
  let cancelPendingSave = () => {};

  if (window.electronAPI?.sqlite) {
    // Desktop: load persisted Yjs state from SQLite via IPC, then subscribe to updates
    const api = window.electronAPI.sqlite;
    void api.loadYjsState(noteId).then((state) => {
      if (state) Y.applyUpdate(doc, state);
    });

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    doc.on("update", () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        const state = Y.encodeStateAsUpdate(doc);
        void api.saveYjsState(noteId, state);
      }, 1000);
    });
    cancelPendingSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
    };
  } else {
    // Web: use IndexedDB for offline persistence
    idbProvider = new IndexeddbPersistence(idbNameFor(noteId), doc);
  }

  const wsProvider = new HocuspocusProvider({
    url: getSyncWsUrl(),
    name: noteId,
    document: doc,
    token: authStorage.getToken() ?? null,
    onStatus: ({ status }) => {
      window.dispatchEvent(new CustomEvent("yjs:ws-status", { detail: status }));
    },
  });

  return { ctx: { doc, wsProvider, idbProvider }, refs: 0, cancelPendingSave };
}

/** Name of the per-note IndexedDB database. Kept here so deletion cannot drift from creation. */
export function idbNameFor(noteId: string): string {
  return `nodeira-note-${noteId}`;
}

/**
 * Takes a reference to the context for `noteId`, creating it if needed. Every call must
 * be paired with exactly one releaseYjsContext. Prefer the useYjsContext hook, which
 * pairs them for you.
 */
export function acquireYjsContext(noteId: string): YjsContext {
  cancelPendingDestroy(noteId);

  let entry = docCache.get(noteId);
  if (!entry) {
    entry = createEntry(noteId);
    docCache.set(noteId, entry);
  }
  entry.refs += 1;
  return entry.ctx;
}

/** Drops a reference. The context is torn down shortly after the last one goes away. */
export function releaseYjsContext(noteId: string) {
  const entry = docCache.get(noteId);
  if (!entry) return;

  entry.refs -= 1;
  if (entry.refs > 0) return;

  cancelPendingDestroy(noteId);
  const timeout = setTimeout(() => {
    pendingDestroys.delete(noteId);
    const current = docCache.get(noteId);
    // A new holder may have arrived during the grace window.
    if (!current || current.refs > 0) return;
    teardown(noteId, current);
  }, DESTROY_GRACE_MS);
  pendingDestroys.set(noteId, timeout);
}

export function getYjsContext(noteId: string): YjsContext | undefined {
  return docCache.get(noteId)?.ctx;
}

/**
 * Tears the context down immediately, ignoring refcounts, and drops the note's local
 * IndexedDB database.
 *
 * Called when a note is deleted. Without the teardown, the socket stays connected to
 * /sync/<deletedId>; without the database drop, every note ever opened leaves a
 * `nodeira-note-<id>` database behind forever, deleted notes included.
 */
export function forgetYjsContext(noteId: string) {
  cancelPendingDestroy(noteId);
  const entry = docCache.get(noteId);
  if (entry) teardown(noteId, entry);

  // Desktop persists to SQLite instead, and the row goes with the note server-side.
  if (!window.electronAPI?.sqlite && typeof indexedDB !== "undefined") {
    indexedDB.deleteDatabase(idbNameFor(noteId));
  }
}

/**
 * Tears down every cached context immediately.
 *
 * Called on logout: providers capture the auth token once at construction and never
 * refresh it, so without this every socket stays open authenticated as the previous
 * user until a full page reload.
 */
export function destroyAllYjsContexts() {
  for (const [noteId, timeout] of pendingDestroys) {
    clearTimeout(timeout);
    pendingDestroys.delete(noteId);
  }
  for (const [noteId, entry] of [...docCache]) {
    teardown(noteId, entry);
  }
}

/** Test/diagnostic helper: how many contexts are currently cached. */
export function cachedContextCount(): number {
  return docCache.size;
}
