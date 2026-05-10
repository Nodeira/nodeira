## 1. Shared UI Package (`packages/ui`) — DEFERRED

> Deferred: components are too coupled to app internals for clean extraction now.
> Desktop renderer loads the `apps/web` Vite build directly (see §2).

- [x] 1.1 ~~Scaffold `packages/ui` workspace~~ — deferred
- [x] 1.2 ~~Move shared components~~ — deferred
- [x] 1.3 ~~Update index.ts~~ — deferred
- [x] 1.4 ~~Add workspace dependency~~ — deferred
- [x] 1.5 ~~Typecheck after extraction~~ — deferred
- [x] 1.6 ~~Add to Turborepo pipeline~~ — deferred

## 2. Electron App Scaffold (`apps/desktop`)

- [x] 2.1 Create `apps/desktop`; write `package.json` with `electron`, `@electron-forge/cli`, `@electron-forge/plugin-vite`, `@electron-forge/maker-squirrel`, `@electron-forge/maker-deb`, `@electron-forge/maker-dmg`, `better-sqlite3`, `@types/better-sqlite3`, `@electron/rebuild`
- [x] 2.2 Add `@nodeira/shared-types` as a workspace dependency in `apps/desktop/package.json`
- [x] 2.3 Create `vite.main.config.ts` (CommonJS/Node target, `better-sqlite3` external) and `vite.preload.config.ts` (sandboxed renderer context, no Node built-ins)
- [x] 2.4 Create `src/main.ts`: open `BrowserWindow` with `contextIsolation: true`, `sandbox: true`; in dev load `http://localhost:5173`, in prod load `file://…/apps/web/dist/index.html`
- [x] 2.5 Create `src/preload.ts`: stub file (channels added in later tasks)
- [x] 2.6 Create `forge.config.ts` wiring Vite plugin to `vite.main.config.ts` + `vite.preload.config.ts`; add Squirrel/deb/dmg makers
- [x] 2.7 Create `tsconfig.json` for `apps/desktop` (CommonJS, Node types for main; DOM types for preload via separate tsconfig.preload.json)
- [ ] 2.8 Verify blank Electron window opens loading the web app with `pnpm run start` in `apps/desktop`
- [x] 2.9 Add `apps/desktop` to Turborepo pipeline (`electron:dev`, `electron:build`, `electron:package` tasks) in `turbo.json`

## 3. Native Menus & System Tray

- [x] 3.1 Build and register the native `Menu` in `src/main.ts`: File, Edit, View (DevTools in dev only), Help sections
- [x] 3.2 Add system tray icon with context menu ("Open Nodeira", "Quit")
- [x] 3.3 Implement single-instance lock (`app.requestSingleInstanceLock`); focus existing window on second launch attempt

## 4. Keyboard Shortcuts

- [x] 4.1 Wire in-app accelerators via the native Menu (New Note `Cmd/Ctrl+N`, Search `Cmd/Ctrl+K`, Toggle Sidebar `Cmd/Ctrl+\`, Settings `Cmd/Ctrl+,`, DevTools `Cmd+Option+I` / `Ctrl+Shift+I` in dev)
- [x] 4.2 Register global shortcuts via `globalShortcut` in the `app.whenReady` block: `Ctrl+Shift+Space` (focus window), `Ctrl+Shift+N` (focus + new note)
- [x] 4.3 Emit an IPC event to the renderer when the "new note" global shortcut fires so the renderer can handle note creation
- [x] 4.4 Unregister all global shortcuts in the `will-quit` handler

## 5. SQLite Persistence (Main Process)

- [x] 5.1 Install `better-sqlite3` and `@types/better-sqlite3`; configure `@electron/rebuild` in `postinstall` to rebuild native addons for the Electron ABI
- [x] 5.2 Create `src/db/database.ts`: open `nodeira.db` at `app.getPath('userData')`, run `CREATE TABLE IF NOT EXISTS` for `yjs_state`, `note_metadata`, `plugin_cache`
- [x] 5.3 Implement Yjs state functions: `loadYjsState(noteId)` and `saveYjsState(noteId, state)` with ≤1 s debounce in renderer
- [x] 5.4 Implement note metadata helpers: `loadNoteMetadata()` and `upsertNoteMetadata(notes)`
- [x] 5.5 Register IPC handlers in `main.ts` for all SQLite channels: `sqlite:loadYjsState`, `sqlite:saveYjsState`, `sqlite:getNoteMetadata`, `sqlite:upsertNoteMetadata`
- [x] 5.6 Expose the four SQLite IPC channels in `src/preload.ts` via `contextBridge`

## 6. Renderer: Yjs + SQLite Integration

- [x] 6.1 Modified `YjsProvider.ts` to detect `window.electronAPI.sqlite` and use IPC-backed SQLite persistence (with 1 s debounce) instead of `y-indexeddb`
- [x] 6.2 `YjsProvider.ts` now builds the correct WS URL from `window.electronAPI.wsBaseUrl` when running in Electron
- [ ] 6.3 On app startup, call `sqlite:getNoteMetadata` and seed TanStack Query cache so the notes list renders immediately without a server round-trip

## 7. Offline / Online Detection

- [x] 7.1 Create `src/store/networkStatusAtom.ts` (Jotai atom, initial value from `navigator.onLine`)
- [x] 7.2 Add `window` event listeners for `online` / `offline` in `AppShell` to update `networkStatusAtom`
- [ ] 7.3 Subscribe to Yjs WebSocket provider's connection status to supplement `navigator.onLine` detection
- [x] 7.4 Display offline status Badge in the app header when `networkStatusAtom === "offline"`
- [x] 7.5 On `networkStatusAtom` transition to `"online"`, invalidate notes queries to trigger a fresh `GET /notes` fetch

## 8. Plugin Offline Cache

- [x] 8.1 Add `plugin_cache` table to `src/db/database.ts`
- [x] 8.2 Implement `getCachedBundle(source)` and `setCachedBundle(source, bundle)` in database module
- [x] 8.3 Register `plugin:getCachedBundle` and `plugin:setCachedBundle` IPC handlers in `main.ts`
- [x] 8.4 Expose both plugin cache channels in `src/preload.ts` via `contextBridge`
- [x] 8.5 Configure Electron CSP in `main.ts` via `session.defaultSession.webRequest.onHeadersReceived`
- [x] 8.6 Modified `apps/web/src/lib/pluginLoader.ts` with `loadFromCdnWithCache`: checks SQLite cache before CDN, writes cache after CDN success, falls back to cache on CDN failure

## 9. Packaging & CI

- [x] 9.1 Configure Electron Forge makers in `forge.config.ts` for Squirrel (Windows), deb (Linux), and dmg (macOS)
- [ ] 9.2 Verify `pnpm run package` in `apps/desktop` produces an output artifact on the local platform
- [x] 9.3 Add `.github/workflows/desktop.yml` CI workflow with matrix of `ubuntu-latest`, `windows-latest`, `macos-latest`
