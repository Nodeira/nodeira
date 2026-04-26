import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

export interface YjsContext {
  doc: Y.Doc;
  wsProvider: WebsocketProvider;
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

export function getOrCreateYjsContext(noteId: string): YjsContext {
  const existing = docCache.get(noteId);
  if (existing) return existing;

  const doc = new Y.Doc();

  // IndexedDB: persists the full Yjs document locally.
  // Restores content before the WebSocket even connects, making offline work seamless.
  const idbProvider = new IndexeddbPersistence(`nodeira-note-${noteId}`, doc);

  // WebSocket: syncs with the NestJS/Hocuspocus server.
  // In dev, Vite proxies /sync → ws://localhost:3001/sync, so we point at Vite.
  const wsBaseUrl = import.meta.env["VITE_SYNC_WS_URL"] ?? "ws://localhost:5173";
  const wsProvider = new WebsocketProvider(wsBaseUrl, noteId, doc, {
    connect: true,
  });

  const ctx: YjsContext = { doc, wsProvider, idbProvider };
  docCache.set(noteId, ctx);
  return ctx;
}

export function destroyYjsContext(noteId: string) {
  const ctx = docCache.get(noteId);
  if (!ctx) return;
  ctx.wsProvider.destroy();
  ctx.idbProvider.destroy();
  ctx.doc.destroy();
  docCache.delete(noteId);
}
