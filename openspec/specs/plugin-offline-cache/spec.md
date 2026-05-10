## ADDED Requirements

### Requirement: Electron CSP permits dynamic plugin imports from jsDelivr

The main process SHALL set a `Content-Security-Policy` response header (via `session.defaultSession.webRequest.onHeadersReceived`) that includes `script-src 'self' cdn.jsdelivr.net 'unsafe-eval'` to permit the dynamic `import()` calls made by `pluginLoader.ts`.

#### Scenario: Plugin loads from CDN while online

- **WHEN** the app is online and an enabled plugin's source points to jsDelivr
- **THEN** the plugin bundle is fetched, evaluated, and registered without a CSP error

---

### Requirement: Plugin bundles are cached in SQLite on first successful load

After a plugin bundle is successfully fetched from the CDN, the main process SHALL store the bundle text in a `plugin_cache` table (`plugin_id TEXT PRIMARY KEY`, `source TEXT`, `bundle TEXT`, `cached_at INTEGER`). The cached bundle SHALL be updated whenever a newer version is fetched.

#### Scenario: Plugin bundle written to cache after CDN fetch

- **WHEN** a plugin is loaded from jsDelivr successfully
- **THEN** a row is upserted in `plugin_cache` with the bundle content and current timestamp

---

### Requirement: Cached plugin bundle is used when CDN is unreachable

The plugin loader in the desktop renderer SHALL, before attempting a CDN fetch, check whether a cached bundle exists via the `plugin:getCachedBundle` IPC channel. If the CDN fetch fails and a cached bundle exists, the cached bundle SHALL be evaluated instead. If neither CDN nor cache is available, loading fails silently with a console error (same as current web behaviour).

#### Scenario: Plugin loads from cache while offline

- **WHEN** `networkStatusAtom` is `"offline"` and an enabled plugin has a cached bundle
- **THEN** the plugin is loaded from the SQLite cache and registers its contributions normally

#### Scenario: Plugin load fails gracefully with no cache and no CDN

- **WHEN** the app is offline and a plugin has no cached bundle
- **THEN** the plugin is skipped with a console error and no unhandled exception is thrown

---

### Requirement: Plugin cache IPC channels are exposed via preload

The preload script SHALL expose:

- `plugin:getCachedBundle(source: string)` → `string | null`
- `plugin:setCachedBundle(source: string, bundle: string)` → `void`

#### Scenario: Renderer retrieves cached bundle via IPC

- **WHEN** the renderer invokes `plugin:getCachedBundle` with a known source string
- **THEN** the main process returns the stored bundle text or `null` if not cached
