## Context

Nodeira's web app (`apps/web`) is a React 19 + Vite + TanStack Router SPA that syncs via Yjs WebSocket to a NestJS backend. The desktop client must deliver the same editing experience natively without requiring a browser, while being resilient to offline conditions. Electron is the chosen shell because it bundles Chromium + Node.js and lets us reuse the React UI wholesale. The main process (Node.js) handles OS integration; the renderer process (Chromium) hosts the React app unchanged or with minimal adaptation.

Current offline story on web: `y-indexeddb` persists Yjs state in the browser's IndexedDB. On desktop we replace this with `better-sqlite3` in the main process — more durable, inspectable, and not subject to browser storage eviction.

## Goals / Non-Goals

**Goals:**

- Ship `apps/desktop` as a new Electron workspace in the monorepo
- Extract a `packages/ui` shared component library so web and desktop render the same UI from one source
- Replace `y-indexeddb` with a SQLite persistence adapter for Yjs in the desktop context
- Detect online/offline state and sync with the NestJS server when connected
- Cache note metadata locally so the notes list renders without a server round-trip
- Produce distributable builds for Linux, Windows, and macOS via Electron Forge

**Non-Goals:**

- Bundling or replacing the NestJS server — the desktop app is a client only
- End-to-end encryption or per-user key management (future)
- Mobile (React Native) — deferred
- Auto-update infrastructure (can be added later with Electron Forge's publisher)

## Decisions

### D1: Renderer loads a bundled Vite build, not a localhost URL

**Decision:** Package the web UI as a static Vite build embedded in the Electron app. The main process loads `file://` rather than pointing at `http://localhost:5173`.

**Rationale:** A `localhost` URL approach requires the dev server to be running and exposes a port. A bundled build is self-contained, works offline, and is correct for production packaging.

**Alternative considered:** Load from `http://localhost:5173` always (dev-only shortcut). Rejected — breaks in packaged builds and in offline scenarios where no server is reachable.

**Dev mode exception:** In development, the renderer loads `http://localhost:5173` (or a Vite dev server spawned inside the Electron process) so hot-module reload works. A `NODE_ENV=development` check in the main process switches between the two.

---

### D2: SQLite persistence via IPC — main process owns the DB, renderer calls over IPC

**Decision:** `better-sqlite3` runs exclusively in the Electron main process. The renderer sends IPC messages (`ipcRenderer.invoke`) to read/write Yjs state and note metadata. We write a thin `SqliteYjsPersistence` class that implements the same interface used by `y-indexeddb`.

**Rationale:** `better-sqlite3` is a native addon and cannot run in the renderer (sandboxed Chromium). Keeping DB access in the main process also centralises file locking and avoids concurrent write races.

**Alternative considered:** Use `sql.js` (pure WASM) in the renderer. Rejected — WASM SQLite is orders of magnitude slower for large Yjs state blobs and doesn't persist to a real file without extra IPC anyway.

---

### D3: `packages/ui` is an extracted subset, not a complete re-export of `apps/web`

**Decision:** Create `packages/ui` containing only the shared presentational components (NoteEditor, Sidebar, NoteList, layout primitives). Route-level components and TanStack Router bindings stay in their respective apps.

**Rationale:** Full extraction would require moving routing, auth context, and app-level providers into the package — high coupling and brittle. A "dumb component" boundary keeps the package lean and testable in isolation.

**Alternative considered:** Copy-paste components into `apps/desktop`. Rejected — divergence between web and desktop UI is the exact problem `packages/ui` solves.

---

### D4: Offline/online detection via `navigator.onLine` + WebSocket close events

**Decision:** The renderer watches `window.addEventListener('online'/'offline')` and also listens for the Yjs WebSocket disconnecting. When offline, note mutations are written to SQLite only. When online is restored, the Yjs provider reconnects automatically (existing y-websocket behaviour) and we fire a REST refresh to repopulate the notes list.

**Rationale:** `navigator.onLine` is coarse (may be true even when the server is unreachable) so the WebSocket state is the authoritative signal for sync availability. Both signals together give accurate UX.

---

### D5: Electron Forge for packaging

**Decision:** Use Electron Forge with `@electron-forge/maker-squirrel` (Windows), `@electron-forge/maker-deb`/`rpm` (Linux), and `@electron-forge/maker-dmg` (macOS).

**Rationale:** Forge is the officially recommended Electron packaging tool, integrates with Vite via `@electron-forge/plugin-vite`, and handles native rebuild of `better-sqlite3` automatically via `@electron-forge/plugin-auto-unpack-natives`.

**Alternative considered:** `electron-builder`. Viable, but Forge's Vite plugin has better first-class support for the main+renderer split we need.

---

### D6: Vite config split — main process and renderer are separate entry points

**Decision:** `apps/desktop` has two Vite configs: `vite.main.config.ts` (CommonJS target, `better-sqlite3` external) and `vite.renderer.config.ts` (browser target, reuses `packages/ui`). Electron Forge's Vite plugin drives both.

**Rationale:** Main process code must target Node.js/CommonJS; renderer targets the browser. A single Vite config cannot satisfy both simultaneously.

## Risks / Trade-offs

- **Native addon rebuild complexity** — `better-sqlite3` must be rebuilt for the Electron ABI on each platform. Electron Forge's `auto-unpack-natives` plugin handles this, but CI matrix (linux/win/mac) adds overhead. → Use `@electron/rebuild` in the `postinstall` script and test all three platforms in CI from the start.

- **`packages/ui` extraction scope creep** — deciding which components belong in the shared package vs. apps is a judgment call that can stall the work. → Start with the minimum set needed by `apps/desktop` (NoteEditor, Sidebar, NoteList); expand later when a concrete need arises.

- **IPC latency for Yjs persistence** — every Yjs update triggers an IPC call to the main process. For rapid keystroke sequences this could queue up. → Debounce persistence calls (same pattern `y-indexeddb` uses internally, ~1 s debounce on `update` events).

- **Renderer sandbox** — Electron's `contextIsolation: true` + `sandbox: true` is the secure default but requires a `preload.js` bridge for IPC. Disabling sandbox for convenience would be a security regression. → Always use `contextIsolation: true`; expose only typed IPC channels via `contextBridge` in the preload script.

- **File:// CORS** — loading the bundled UI from `file://` can cause CORS issues with fetch calls targeting the NestJS REST API. → Configure the NestJS CORS policy to allow `file://` origin in production builds, and use Electron's `protocol.handle` to serve assets from a custom `app://` scheme if needed.

---

### D7: Plugin system works as-is in the desktop renderer; add CDN caching for offline

**Decision:** The existing plugin loader (`pluginLoader.ts`) runs unchanged in the Electron renderer process — Chromium handles dynamic `import()` from jsDelivr CDN the same way the web browser does. Plugin install records already sync via the server DB, so plugins installed from the web UI are automatically available on the desktop after the next server sync.

Two additions are needed:

1. **CSP header** — Electron's main process must set a `Content-Security-Policy` that allows `script-src cdn.jsdelivr.net` so dynamic plugin imports aren't blocked by the default restrictive CSP.
2. **Offline plugin cache** — On first successful load, serialize each plugin bundle into SQLite. On subsequent loads, if the CDN fetch fails (offline), fall back to the cached bundle. This extends `SqliteYjsPersistence` with a `plugin_cache` table (`pluginId`, `source`, `bundle TEXT`, `cachedAt`).

**Native plugins (Node.js main process) are out of scope for this change.** The renderer-only plugin model is sufficient for parity with the web app.

**Alternative considered:** Ship plugin bundles inside the Electron package. Rejected — plugins are user-installed at runtime; bundling them at build time defeats the purpose.

---

## Migration Plan

1. Create `packages/ui` and move shared components; update `apps/web` to import from it — verify web app unchanged.
2. Scaffold `apps/desktop` with Electron Forge + Vite plugin; confirm blank window renders.
3. Wire renderer to load `packages/ui` components and connect to the running NestJS server over WS.
4. Implement `SqliteYjsPersistence` in the main process; wire IPC; validate offline note editing persists across app restarts.
5. Add offline/online detection; confirm sync resumes on reconnect.
6. Test packaging on all three platforms (CI matrix).

Rollback: `apps/web` is unaffected throughout. `packages/ui` extraction is additive — reverting means re-inlining components into `apps/web`, which is mechanical.
