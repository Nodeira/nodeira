## 1. Monorepo Integration

- [x] 1.1 Add `apps/mobile` to `pnpm-workspace.yaml`
- [x] 1.2 Bootstrap Expo app in `apps/mobile` with `create-expo-app` (SDK 56, TypeScript template), package name `@nodeira/mobile`
- [x] 1.3 Configure `apps/mobile/metro.config.js` with `watchFolders` pointing to repo root and `resolver.nodeModulesPaths` for workspace resolution
- [x] 1.4 Add `@nodeira/shared-types` as a workspace dependency in `apps/mobile/package.json`
- [x] 1.5 Add `dev` and `build` entries for `@nodeira/mobile` in root `turbo.json`
- [ ] 1.6 Verify `pnpm exec turbo run dev --filter=@nodeira/mobile` starts the Expo dev server _(manual: run and scan QR with Expo Go)_

## 2. Expo Router Navigation

- [x] 2.1 Install and configure Expo Router v3; convert to `app/` directory structure
- [x] 2.2 Create root layout `app/_layout.tsx` with Stack navigator
- [x] 2.3 Create note list screen `app/index.tsx` (full implementation)
- [x] 2.4 Create note editor screen `app/note/[id].tsx` (full implementation)
- [ ] 2.5 Verify back navigation from editor returns to note list _(manual: test in Expo Go)_

## 3. API Integration & Auth

- [x] 3.1 Install `expo-secure-store` and create `src/lib/auth.ts` with `saveToken`, `getToken`, `clearToken` helpers
- [x] 3.2 Create `src/lib/api.ts` with a base fetch wrapper that attaches the `Bearer` token header
- [x] 3.3 Implement login screen `app/login.tsx` that calls the existing `/auth` endpoint and saves the JWT to SecureStore
- [x] 3.4 Add auth guard in root layout: redirect unauthenticated users to `/login`
- [x] 3.5 Implement logout action that clears the token and redirects to `/login`

## 4. Note List Screen

- [x] 4.1 Implement `GET /api/notes` fetch in note list screen using TanStack Query
- [x] 4.2 Render note list with title and last-modified timestamp using NativeWind styles
- [x] 4.3 Add loading skeleton while notes are fetching
- [x] 4.4 Add error state UI when the API request fails
- [x] 4.5 Add empty state UI with "Create note" call-to-action when no notes exist
- [x] 4.6 Implement "New note" action: call `POST /api/notes`, then navigate to editor

## 5. Yjs Persistence Provider

- [x] 5.1 Install `@react-native-async-storage/async-storage`, `yjs`, `y-websocket`
- [x] 5.2 Implement `AsyncStorageYjsPersistence` class in `src/providers/AsyncStorageYjsPersistence.ts` (load state on construction, debounced write on update, `destroy()` method)
- [x] 5.3 Verify storage key schema: `yjs_state_<noteId>`
- [x] 5.4 Add graceful handling for null/corrupt AsyncStorage values (warn + empty doc)
- [x] 5.5 Implement `YjsProvider.ts` module-level `Map<noteId, YjsContext>` cache
- [x] 5.6 Implement `getYjsContext(noteId)` that returns cached context or creates a new one (doc + persistence + WebSocket provider)

## 6. Note Editor Screen

- [x] 6.1 Wire note editor screen to `getYjsContext(id)` from the Yjs provider
- [x] 6.2 Integrate a text editor component bound to the `Y.Doc`'s `Y.Text` — plain `TextInput` synced to Yjs text (TipTap RN not yet stable)
- [ ] 6.3 Verify edits are persisted to AsyncStorage within 500 ms of last keystroke _(manual: edit note, kill app, reopen — content should be restored)_
- [ ] 6.4 Verify navigating away and back to the same note reuses the cached `Y.Doc` (no duplicate WebSocket connection) _(manual: check with server logs)_

## 7. Offline Sync & Network Awareness

- [x] 7.1 Install `@react-native-community/netinfo` and create `networkStatusAtom` Jotai atom
- [x] 7.2 Subscribe to `NetInfo.addEventListener` in a root-level effect and update `networkStatusAtom`
- [x] 7.3 Implement offline banner component; show it when `networkStatusAtom === "offline"`
- [x] 7.4 Wire `AppState` listener in `YjsProvider.ts`: disconnect WebSocket on `background`, reconnect on `active`
- [ ] 7.5 Verify offline edits sync after device reconnects _(manual: airplane mode → edit → reconnect → confirm sync)_

## 8. NativeWind Styling

- [x] 8.1 Install and configure NativeWind v4 with Expo
- [x] 8.2 Apply consistent styling to note list, note editor, login, and offline banner screens
- [x] 8.3 Ensure dark mode support via NativeWind `dark:` variants

## 9. CI (EAS Build)

- [x] 9.1 Create `apps/mobile/eas.json` with `development`, `preview`, and `production` build profiles
- [x] 9.2 Register the Expo project slug (project ID: fe9e1801-f8f9-4ee0-95f0-cd2f14bf6e37 already set in app.json)
- [x] 9.3 Add GitHub Actions job that runs EAS Build for iOS and Android on pushes to `main`
- [x] 9.4 Gate EAS builds so they only run on `main` and release tags (not PRs)

## 10. Shared UI Package Spec Update

- [x] 10.1 Update `openspec/specs/shared-ui-package/spec.md` (already done in this change's delta spec) — verify the archive step merges it correctly; no code changes needed
