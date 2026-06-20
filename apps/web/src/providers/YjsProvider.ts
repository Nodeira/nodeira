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

/**
 * Module-level cache: one Yjs doc + providers per noteId.
 *
 * Stored at module scope (not React state) so that:
 * - Docs survive React re-renders and route transitions without reconnecting
 * - Multiple components can share the same doc (editor, status indicator, etc.)
 * - WebSocket connections are not torn down on every render
 */
const docCache = new Map<string, YjsContext>();

// Pending destroys are deferred briefly so that:
// - React 19 StrictMode's mount→unmount→remount in dev doesn't tear down the
//   WebSocket mid-handshake (which logs "closed before established")
// - Rapid back-and-forth navigation between two notes reuses the same provider
const pendingDestroys = new Map<string, ReturnType<typeof setTimeout>>();
const DESTROY_GRACE_MS = 250;

export function getOrCreateYjsContext(noteId: string): YjsContext {
  const pending = pendingDestroys.get(noteId);
  if (pending) {
    clearTimeout(pending);
    pendingDestroys.delete(noteId);
  }

  const existing = docCache.get(noteId);
  if (existing) return existing;

  const doc = new Y.Doc();

  let idbProvider: IndexeddbPersistence | null = null;

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
  } else {
    // Web: use IndexedDB for offline persistence
    idbProvider = new IndexeddbPersistence(`nodeira-note-${noteId}`, doc);
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

  const ctx: YjsContext = { doc, wsProvider, idbProvider };
  docCache.set(noteId, ctx);
  return ctx;
}

export function destroyYjsContext(noteId: string) {
  const previous = pendingDestroys.get(noteId);
  if (previous) clearTimeout(previous);
  const timeout = setTimeout(() => {
    pendingDestroys.delete(noteId);
    const ctx = docCache.get(noteId);
    if (!ctx) return;
    ctx.wsProvider.destroy();
    ctx.idbProvider?.destroy();
    ctx.doc.destroy();
    docCache.delete(noteId);
  }, DESTROY_GRACE_MS);
  pendingDestroys.set(noteId, timeout);
}
