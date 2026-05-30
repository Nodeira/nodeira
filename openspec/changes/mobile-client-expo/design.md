## Context

Nodeira's core sync contract is already mobile-friendly: the NestJS/Hocuspocus WebSocket server speaks the standard y-websocket protocol, and `packages/shared-types` is framework-agnostic. The gap is the presentation and persistence layer — the web app uses Mantine (web-only), y-indexeddb (IndexedDB, browser-only), and TanStack Router (web-only).

The mobile client must replicate the same offline-first CRDT model using React Native equivalents, while fitting cleanly into the existing Turborepo monorepo.

## Goals / Non-Goals

**Goals:**
- Expo (React Native) app that runs on iOS and Android
- Same offline-first note editing experience as web, powered by the same Yjs/Hocuspocus backend
- Shared business logic and types; no duplication of API contracts
- Expo Router for file-based navigation (consistent with web's file-based routing convention)
- Turborepo pipeline integration (dev, build, typecheck, test)
- EAS Build for CI distribution

**Non-Goals:**
- Sharing UI components with `packages/ui` — Mantine is web-only; mobile gets its own UI
- Feature parity at launch: plugin architecture, graph view, canvas are deferred
- React Native Web (keep the web bundle separate from the Expo bundle)
- Over-the-air (OTA) updates configuration (can be added later via EAS Update)

## Decisions

### D1: Expo SDK (managed workflow) over bare React Native

**Choice:** Expo managed workflow with SDK 52+.

**Rationale:** Managed workflow gives us Expo Router, SecureStore, NetInfo, and EAS Build out of the box with zero native module configuration. The app has no native-only requirements (camera, Bluetooth, NFC) that would force an eject. Bare workflow can be adopted later if needed.

**Alternative considered:** Bare React Native — rejected because the bootstrapping cost (Xcode/Android Studio configuration, podfile management) outweighs any flexibility benefit at this stage.

---

### D2: AsyncStorage for Yjs persistence (not SQLite)

**Choice:** `@react-native-async-storage/async-storage` as the Yjs state store via a thin custom provider (`AsyncStorageYjsPersistence`).

**Rationale:** y-indexeddb's API (keyed binary blobs per document) maps cleanly to AsyncStorage. The provider is ~80 lines; no native module linking is needed in Expo managed workflow. SQLite (via `expo-sqlite`) would be more performant for large datasets but adds complexity and native linking.

**Alternative considered:** `expo-sqlite` — deferred; can be adopted as `mobile-persistence` matures and note counts grow. The spec (`mobile-yjs-persistence`) is defined so the provider interface stays stable even if the backing store changes.

**Trade-off:** AsyncStorage is limited to ~6 MB per key on some Android targets. For notes with very large Yjs state vectors this could be a problem. Mitigation: chunk large documents or switch to `expo-sqlite` when the limit is hit.

---

### D3: y-websocket for sync (same as web)

**Choice:** `y-websocket`'s `WebsocketProvider` connecting to the existing NestJS Hocuspocus endpoint.

**Rationale:** Hocuspocus speaks the y-websocket sub-protocol. React Native's built-in WebSocket implementation is protocol-compatible. No server changes needed.

**Alternative considered:** Polling REST snapshots — rejected; loses real-time collaboration and the offline CRDT merge story.

---

### D4: Expo Router for navigation

**Choice:** File-based routing with Expo Router v3 (`app/` directory).

**Rationale:** Mirrors TanStack Router's file-based convention used on web. Stack navigator for note list → note editor, tab navigator for future sections (Graph, Settings).

**Alternative considered:** React Navigation (manual) — rejected; Expo Router wraps React Navigation with the same file-based DX the team already uses.

---

### D5: NativeWind for styling (not Mantine)

**Choice:** NativeWind v4 (Tailwind CSS for React Native) for the mobile UI layer.

**Rationale:** Tailwind utility classes are familiar to the team and composable. NativeWind v4 works with Expo SDK 52. Mantine is DOM-dependent and cannot run in React Native.

**Alternative considered:** React Native Paper — reasonable but adds an opinionated Material Design look; NativeWind gives more control and design system flexibility.

---

### D6: Turborepo pipeline integration

`apps/mobile` is added as a workspace package. `turbo.json` gets `dev` and `build` entries for `@nodeira/mobile`. The Expo dev server (`expo start`) is the `dev` script; `eas build` is the `build` script (CI only, not local).

---

### D7: Auth — Expo SecureStore + existing API

The existing `/auth` REST endpoints are reused. JWT tokens are stored in `expo-secure-store` (hardware-backed keychain on iOS, Android Keystore on Android). No new auth backend work needed.

## Risks / Trade-offs

- **AsyncStorage size limit** → Mitigation: monitor document size; migrate to `expo-sqlite` if needed (spec interface is stable)
- **WebSocket keep-alive on mobile** → iOS/Android aggressively kill background WebSocket connections. Mitigation: reconnect on `AppState` foreground event; y-websocket has built-in reconnection logic
- **TipTap React Native availability** → TipTap's RN support is experimental. Mitigation: design editor interface behind an abstraction; fall back to a plain `TextInput`-based editor if TipTap RN proves unstable. Spec does not mandate TipTap specifically.
- **EAS Build minutes cost** → Free tier may be insufficient for frequent CI builds. Mitigation: gate EAS builds to `main` branch and release tags only
- **Monorepo Metro bundler** → Metro (React Native bundler) requires explicit `watchFolders` configuration to resolve workspace packages. Mitigation: configure `metro.config.js` with `watchFolders: [path to repo root]` and resolver `nodeModulesPaths`

## Open Questions

- **Editor library**: Confirm TipTap React Native (`@tiptap/react-native`) is stable enough for production use, or decide on a fallback (Lexical RN? Plain TextInput with markdown rendering?)
- **Expo Go vs Dev Client**: Should developers use Expo Go (faster setup) or a custom dev client (needed if any native modules are added)? Start with Expo Go; create dev client if native deps are added. (Lets use Expo Go for now, may need to switch later)
- **EAS project slug**: Needs to be registered under the Nodeira Expo account before CI runs.
New project created (nodeira), instructions: npm install --global eas-cli
eas init --id fe9e1801-f8f9-4ee0-95f0-cd2f14bf6e37
