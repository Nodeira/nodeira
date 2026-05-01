import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";

export interface YjsContext {
  doc: Y.Doc;
  wsProvider: HocuspocusProvider;
  idbProvider: IndexeddbPersistence;
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

  // IndexedDB: persists the full Yjs document locally.
  // Restores content before the WebSocket even connects, making offline work seamless.
  const idbProvider = new IndexeddbPersistence(`nodeira-note-${noteId}`, doc);

  // WebSocket: syncs with the NestJS/Hocuspocus server using the Hocuspocus
  // wire protocol. The note id is sent in-protocol as `name`, not in the URL,
  // so the gateway path stays a static `/sync`.
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const wsBaseUrl =
    import.meta.env["VITE_SYNC_WS_URL"] ?? `${proto}://${window.location.host}/sync`;
  const wsProvider = new HocuspocusProvider({
    url: wsBaseUrl,
    name: noteId,
    document: doc,
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
    ctx.idbProvider.destroy();
    ctx.doc.destroy();
    docCache.delete(noteId);
  }, DESTROY_GRACE_MS);
  pendingDestroys.set(noteId, timeout);
}
