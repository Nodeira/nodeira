## Why

Nodeira's web app and desktop client (planned) need a mobile counterpart so users can read and edit notes on iOS and Android. Expo (React Native) is the natural fit given the existing React codebase and the monorepo's workspace structure — it shares types, business logic, and the Yjs sync protocol without forcing a full UI rewrite.

## What Changes

- New `apps/mobile` Expo (React Native) workspace added to the monorepo
- Expo Router for file-based navigation (mirrors TanStack Router convention in web)
- Yjs sync via y-websocket pointing at the existing NestJS Hocuspocus endpoint
- Mobile-local Yjs persistence using AsyncStorage (replaces y-indexeddb used on web)
- RichText editing via TipTap React Native or a lightweight alternative (to be confirmed in design)
- Shared types consumed from `packages/shared-types` (already exists)
- `packages/ui` shared component package — **NOT shared with mobile**: Mantine v9 is web-only; mobile gets its own NativeWind / React Native Paper UI layer
- CI: add Expo EAS Build jobs for iOS and Android
- Auth: reuse the existing API auth endpoints; store tokens in Expo SecureStore

## Capabilities

### New Capabilities

- `mobile-app-shell`: Expo Router app scaffold, workspace integration, navigation structure (note list → editor), and Turborepo pipeline entry
- `mobile-yjs-persistence`: AsyncStorage-backed Yjs persistence provider for React Native, equivalent to y-indexeddb on web
- `mobile-offline-sync`: Mobile-specific network awareness (NetInfo), offline editing, and reconnection behaviour using the existing Hocuspocus WebSocket endpoint

### Modified Capabilities

- `shared-ui-package`: Add explicit note that `packages/ui` is web/desktop only; mobile uses its own UI layer. No behavior change — documentation delta only.

## Impact

- **Monorepo:** new `apps/mobile/` workspace; `pnpm-workspace.yaml` and root `turbo.json` updated
- **`packages/shared-types`:** consumed as-is; no changes needed
- **`apps/api`:** no changes — mobile connects to the same REST + WebSocket endpoints
- **New deps:** `expo`, `expo-router`, `@expo/vector-icons`, `expo-secure-store`, `@react-native-community/netinfo`, `expo-sqlite` or `@react-native-async-storage/async-storage`, `yjs`, `y-websocket`
- **CI:** Expo EAS Build config + GitHub Actions jobs
