# Nodeira Android (native rewrite)

Native Android (Kotlin) replacement for the Expo/React Native `apps/mobile`. The note
editor — the only Yjs/CRDT surface — is hosted in a **WebView** running the existing web
editor, which avoids reimplementing Yjs + the Hocuspocus protocol in Kotlin. Everything
else is being rebuilt as native screens. See the plan in
`~/.claude/plans/okay-fdroid-publish-works-parsed-stardust.md`.

> Status: **Feature-complete for cutover.** WebView editor + canvas sync proven (live +
> offline). Native Compose login, notes browsing, graph, canvases, reminders (time +
> location/geofence), and settings are in place. Next: the cutover (move to apps/mobile,
> delete RN, tag a release).
>
> Implemented so far:
>
> - `MainActivity` — Compose host + Navigation drawer (Home / Recents / Quick notes /
>   Canvases / Graph / Reminders / Settings / Log out); startup screen is configurable.
> - `ui/login` — native sign-in (server URL + email + password) → `POST /auth/login`.
> - `ui/home`, `ui/recents`, `ui/quicknotes` — notes browsing (`GET /notes`) with a shared
>   `NotesViewModel`; search + sort; tapping a note opens the editor WebView.
> - `ui/graph` — native force-directed graph over `/notes/graph` (Compose Canvas, fit-to-view,
>   tap a node to open it).
> - `ui/canvases` — native list/create/delete over `/canvases`; opening a canvas loads the
>   React Flow editor in a WebView (`/embed/canvas/<id>`).
> - `ui/reminders` + `reminders/` — list + editor (Time: date/recurrence; Location: geofence
>   with current-location capture, radius, notify-on-leave). TIME → `AlarmManager`;
>   LOCATION → `LocationManager.addProximityAlert` (both Google-Play-Services-free). A
>   `ReminderCache` + `BootReceiver` re-registers everything after a reboot.
> - `ui/settings` — server/account info, startup-screen preference, version.
> - `editor/EditorWebViewActivity` — embedded web surfaces (note editor / canvas) launched
>   with the stored server URL + JWT; path-based (`/embed/note/<id>`, `/embed/canvas/<id>`).
> - `data/*` — `AuthStorage`, `SettingsStorage`, Retrofit `NodeiraApi`, `NetworkModule`
>   (dynamic base URL + bearer interceptor; `encodeDefaults` so required enum fields are
>   sent), `NodeiraRepository`. Manual DI via `NodeiraApp.container`.
>
> Known follow-ups:
>
> - Reminders are rescheduled when the list loads but do **not** yet survive a reboot
>   (needs a `BootReceiver` + local cache).
> - LOCATION/geofence reminders not implemented yet (geofencing API + background-location
>   permission).

## Prerequisites

- Android Studio (provides the SDK + JBR). SDK 36 platform + build-tools installed.
- `JAVA_HOME` pointed at a JDK 17–21 (the Android Studio JBR works:
  `E:\Android Studio\jbr`).
- `local.properties` with `sdk.dir=...` (gitignored; create if missing).

## Build

The web build is bundled into the APK as offline assets. Build it and copy it in first:

```powershell
# 1. Build the web app (from repo root)
pnpm --filter @nodeira/web build

# 2. Copy the build into Android assets (overwrites)
Remove-Item -Recurse -Force apps/mobile/app/src/main/assets/web -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force apps/mobile/app/src/main/assets/web | Out-Null
Copy-Item apps/web/dist/* apps/mobile/app/src/main/assets/web -Recurse -Force

# 3. Build the APK
$env:JAVA_HOME = "E:\Android Studio\jbr"
apps/mobile/gradlew.bat -p apps/mobile :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.

> Note: `app/src/main/assets/web/` is gitignored — it is a generated copy of the web build.
> CI builds the web app and copies it in (see plan §5).

## Run it

1. Start the backend + Postgres and the web app (`pnpm run dev` from repo root).
2. Install + launch. `adb` ships with the SDK platform-tools; if it isn't on PATH, use the
   full path (PowerShell):
   ```powershell
   $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adb install -r apps/mobile/app/build/outputs/apk/debug/app-debug.apk
   ```
   To put `adb` on PATH permanently (new terminals only):
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
   ```
   (If you get `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the old RN build's signature differs —
   uninstall it first: `& $adb uninstall com.deranjer.nodeira`.)
3. On the **Sign in** screen enter:
   - **Server URL**: `http://10.0.2.2:3001` (emulator → host) or your LAN IP / https URL.
   - your **email** + **password**.
4. The notes list loads. Tap a note → the editor WebView opens and syncs.

Sync gate (verified): edits sync live with the web client; airplane mode → edits persist
(IndexedDB) → reconnect merges with no loss.

Debug the WebView from Chrome: `chrome://inspect` → remote target
(`setWebContentsDebuggingEnabled(true)` is on).

## How the WebView integration works

- `EditorWebViewActivity` serves `assets/web/` from the virtual https origin
  `appassets.androidplatform.net`, with an `index.html` SPA fallback for unknown paths.
- It rewrites `index.html` on the fly to inject:
  - `<base href="/">` so the web build's relative asset URLs (Vite `base: "./"`, needed for
    Electron) resolve from the origin root under the nested `/embed/note/<id>` route.
  - `window.nodeiraNative = { apiBaseUrl, wsBaseUrl }` and the JWT into `localStorage`,
    read by `apps/web` `serverConfig.ts` + `authStorage`.
- The web side exposes chrome-less `/embed/note/$noteId` and `/embed/canvas/$canvasId`
  routes (`apps/web`) that render only the editor / canvas.

## Release (F-Droid)

This app has no large native libraries, so it ships as a **single universal signed APK**
(no per-ABI splits — that was only needed for the RN app's Hermes/native code).

`.github/workflows/android-kotlin-release.yml` (manual trigger for now) builds the web app,
copies it into assets, runs `:app:assembleRelease`, and uploads `nodeira-<version>.apk` to
the GitHub Release that `deranjer/fdroid` polls. Signing uses the existing
`ANDROID_KEYSTORE_*` secrets (same key as the RN app → clean upgrade of
`com.deranjer.nodeira`). Version name/code come from the release tag via `VERSION_NAME` /
`VERSION_CODE` env (read in `app/build.gradle.kts`).

## Releasing

The cutover from the Expo/React Native app is done — this Kotlin app _is_ `apps/mobile`, and
`.github/workflows/android-release.yml` is tag-triggered. To ship a release: bump the version
above the last RN release (1.7.0) and push a `v*` tag; CI builds + signs + uploads the APK,
and `deranjer/fdroid` serves it.

## Known limitations / follow-ups

- Cleartext + `MIXED_CONTENT_ALWAYS_ALLOW` are enabled for local http testing; not needed
  against an https server.
- Geofence create + fire was not yet exercised end-to-end on a device (the dev JWT had
  expired); the code path is wired and the proximity-alert approach is standard. Verify by
  logging in, creating a Location reminder, and walking into the radius (or `adb emu geo fix`).
- Image-upload file picker inside the editor WebView is untested (bridge to the native
  Android Photo Picker if `<input type=file>` is insufficient).
- No custom launcher icon yet (uses the default).
- R8/minification is off; could be enabled later (needs Compose + serialization keep rules).
- Location reminders pick a point by current location or manual lat/lng — no map picker yet.
