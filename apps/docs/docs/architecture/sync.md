---
id: sync
sidebar_position: 2
---

# Real-time Sync

Nodeira uses [Yjs](https://yjs.dev) CRDTs to provide offline-first, conflict-free document editing with real-time collaboration.

## How it works

Every note is a separate `Y.Doc`. Three layers keep it alive:

```
Browser
  ├── TipTap editor   ← renders the Y.Doc as rich text
  ├── Y.Doc           ← in-memory source of truth
  ├── y-indexeddb     ← persists to IndexedDB (survives refresh/offline)
  └── y-websocket     ← syncs with the server when online
          ↓ /sync/<noteId>
NestJS (Hocuspocus)
  ├── onLoadDocument  → reads yjsState (base64) from PostgreSQL
  └── onStoreDocument → writes merged state back to PostgreSQL
          ↓
PostgreSQL  (notes.yjs_state TEXT column)
```

## Offline-first guarantee

When the app loads:

1. `y-indexeddb` restores the full document from IndexedDB instantly — the editor is usable before any network request.
2. `y-websocket` connects and performs the Yjs sync handshake.
3. Yjs automatically merges local and remote state — no application-level conflict resolution needed.

When the user goes offline, edits accumulate in IndexedDB. On reconnect, the merge happens transparently.

## Why raw WebSocket (not Socket.IO)

Hocuspocus implements the y-websocket protocol which requires raw WebSocket framing. The NestJS WS adapter is configured with `WsAdapter` from `@nestjs/platform-ws` instead of the default Socket.IO adapter.

## Module-level Yjs context cache

The `YjsProvider` module (`src/providers/YjsProvider.ts`) keeps a `Map<noteId, YjsContext>` at module scope — outside React. This is intentional: Yjs WebSocket connections must survive re-renders and route transitions. Storing them in React state would cause unnecessary reconnects.

## TipTap + Yjs

TipTap's `StarterKit` must always be configured with `{ undoRedo: false }` when Yjs is in use. Yjs owns undo/redo history via its own undo manager; allowing TipTap's history plugin to run alongside it would produce conflicts.
