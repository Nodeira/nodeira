# Nodeira mobile — F-Droid distribution

The Android app ships through a **self-hosted F-Droid repo** (`deranjer/fdroid`)
that indexes prebuilt, signed APKs from this repo's GitHub Releases. F-Droid does
**not** build from source — it only verifies and indexes the APK.

We build the APKs from the Expo app without EAS:

```
expo prebuild --platform android   # generates native android/
gradlew assembleRelease            # builds one APK per ABI
apksigner sign ...                 # signs each with a stable release key
```

This is automated in `.github/workflows/android-release.yml`, which runs on every
`v*` tag (and can be dispatched manually). It attaches `nodeira-<version>-<abi>.apk`
to the matching GitHub Release. The F-Droid repo's daily `update.yml` pulls them and
regenerates its index; the F-Droid client serves the right ABI per device.

## Per-ABI splits

Instead of one ~115 MB universal APK, the `withAbiSplits` config plugin
(`plugins/withAbiSplits.js`, wired in `app.json`) emits one APK per ABI
(~40–50 MB each): `armeabi-v7a`, `arm64-v8a`, `x86_64`. Each gets a distinct,
monotonic `versionCode` (`base * 10 + abiIndex`, e.g. `1.7.0` → 107001/107002/107003)
so F-Droid can index them as alternatives of the same package. The plugin runs
during `expo prebuild`, so local and CI builds behave identically.

## Metro server root

`apps/mobile/.env` sets `EXPO_NO_METRO_WORKSPACE_ROOT=1` (and the CI assemble step
sets it too). This pins Metro's server root to `apps/mobile`, matching the
traditional `metro.config.js`. Without it, release JS bundling (`export:embed`)
fails with _"Unable to resolve module ../../node_modules/expo-router/entry.js"_.
The `.env` is committed via a `.gitignore` exception — it holds build config only,
**no secrets**.

## One-time setup (required before the workflow can sign)

### 1. Generate a release keystore

Keep this file safe and **back it up** — Android updates only install if signed by
the same key. Losing it means users must uninstall/reinstall. Store it **outside
the repo**; `*.jks`/`*.keystore`/`*.p12` are gitignored as a safety net, but the
key should never live in version control.

```bash
# Linux/macOS (bash)
keytool -genkeypair -v \
  -keystore nodeira-release.jks \
  -alias nodeira \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <STORE_PASS> -keypass <KEY_PASS> \
  -dname "CN=Nodeira, O=deranjer, C=US"
```

```powershell
# Windows PowerShell (single line; keytool ships with the JDK)
keytool -genkeypair -v -keystore nodeira-release.jks -alias nodeira -keyalg RSA -keysize 2048 -validity 10000 -storepass <STORE_PASS> -keypass <KEY_PASS> -dname "CN=Nodeira, O=deranjer, C=US"
```

### 2. Add repo secrets (Settings → Secrets and variables → Actions) on `Nodeira/nodeira`

| Secret                      | Value                              |
| --------------------------- | ---------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | base64 of the keystore (see below) |
| `ANDROID_KEYSTORE_PASSWORD` | the `-storepass` above             |
| `ANDROID_KEY_ALIAS`         | `nodeira`                          |
| `ANDROID_KEY_PASSWORD`      | the `-keypass` above               |

Base64-encode the keystore:

```bash
# Linux/macOS
base64 -w0 nodeira-release.jks
```

```powershell
# Windows PowerShell (copies to clipboard)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("nodeira-release.jks")) | Set-Clipboard
```

### 3. F-Droid repo (`deranjer/fdroid`)

- `metadata/com.deranjer.nodeira.yml` is committed there.
- `update.yml` now downloads the Nodeira APK alongside Domitara's.
- If `Nodeira/nodeira` is **private**, add a `NODEIRA_RELEASE_TOKEN` secret on the
  fdroid repo (a PAT with read access to this repo's releases). If it's public,
  the default token suffices.

## Caveat: de-Googled devices

Remote push (`expo-notifications`) goes through FCM/Firebase, so it won't work on
phones without Google Play Services. Local/scheduled notifications still work, and
`expo-location` falls back to the OS location provider (geofencing may not fire).
