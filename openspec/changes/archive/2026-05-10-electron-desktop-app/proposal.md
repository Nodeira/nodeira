## Why

Nodeira's web app proves the core sync/editing architecture works; the next step is a native desktop client so users get OS-level features (system tray, native menus, file associations, offline-first without a browser tab) without running a separate server locally. An Electron app lets us reuse the existing React UI while adding a local SQLite persistence layer to replace `y-indexeddb`, enabling true offline operation with automatic sync on reconnect.

## What Changes

- Add `apps/desktop` as a new Turborepo workspace — an Electron application that embeds the Nodeira web UI in its renderer process
- Extract shared React UI components into a new `packages/ui` workspace, consumed by both `apps/web` and `apps/desktop`
- Replace `y-indexeddb` in the desktop context with `better-sqlite3` for local Yjs state persistence so notes survive offline
- Add an Electron main process that manages window lifecycle, native menus, system tray, IPC bridge, and keyboard shortcuts (in-app accelerators + global hotkeys via `globalShortcut`)
- Add an offline/online detection layer: when disconnected the desktop app writes to local SQLite; when reconnected it syncs with the NestJS server via the existing Yjs WebSocket protocol
- Add a local REST proxy / cache so note metadata (list, create, delete) works offline without hitting the server
- Add Electron Forge (or electron-builder) packaging for Linux, Windows, and macOS builds

## Capabilities

### New Capabilities

- `electron-app-shell`: Electron main process — window management, native menus, system tray, IPC channels, and app packaging/build configuration
- `shared-ui-package`: New `packages/ui` workspace extracting reusable React components from `apps/web` so both web and desktop renderers share the same UI library
- `local-sqlite-persistence`: `better-sqlite3`-backed Yjs document persistence in the desktop context, replacing `y-indexeddb`; also caches note metadata (title, timestamps) for offline list rendering
- `offline-sync`: Network-aware sync layer — detects online/offline state, queues changes locally when disconnected, and triggers Yjs resync + REST refresh when connection is restored
- `plugin-offline-cache`: SQLite cache for plugin bundles so plugins loaded from jsDelivr CDN remain available when the desktop app is offline; also requires Electron CSP configuration to permit CDN script imports

### Modified Capabilities

<!-- No existing spec-level behavior changes — all new -->

## Impact

- **New packages**: `apps/desktop` (Electron + Vite renderer), `packages/ui` (shared React component library)
- **Shared UI**: components extracted from `apps/web` into `packages/ui`; both `apps/web` and `apps/desktop` consume it
- **Dependencies**: `electron`, `electron-forge` (or `electron-builder`), `better-sqlite3` (Node.js SQLite — Electron's main process is Node.js, not Bun), `electron-store` for app config
- **Server unchanged**: NestJS API and Hocuspocus sync gateway need no changes — the desktop app speaks the same protocols
- **Build pipeline**: adds Turborepo tasks for `electron:dev`, `electron:build`, and `electron:package`
- **Vite config**: renderer process needs a separate Vite config pointing at the Electron renderer entry point
