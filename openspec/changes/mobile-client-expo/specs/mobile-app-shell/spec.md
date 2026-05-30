## ADDED Requirements

### Requirement: `apps/mobile` workspace is created as an Expo managed-workflow app

A new pnpm workspace `apps/mobile` SHALL be created using Expo SDK 52+ in managed workflow. It SHALL be registered in `pnpm-workspace.yaml` as `apps/mobile`. The `package.json` name SHALL be `@nodeira/mobile`. Turborepo `turbo.json` SHALL include `@nodeira/mobile` in `dev` and `build` pipeline tasks.

#### Scenario: Mobile dev server starts from monorepo root

- **WHEN** `pnpm exec turbo run dev --filter=@nodeira/mobile` is executed at the monorepo root
- **THEN** the Expo dev server starts on the default Expo port and displays a QR code for Expo Go

#### Scenario: Shared types resolve in mobile workspace

- **WHEN** `apps/mobile` imports from `@nodeira/shared-types`
- **THEN** TypeScript resolves the import from `packages/shared-types` with no errors

---

### Requirement: Expo Router provides file-based navigation

The app SHALL use Expo Router v3 with the `app/` directory convention. The root layout SHALL define a stack navigator with two routes: `(tabs)/index` (note list) and `note/[id]` (note editor).

#### Scenario: Navigating to a note opens the editor

- **WHEN** the user taps a note in the note list
- **THEN** the app navigates to `note/[id]` with the correct note ID in the URL params

#### Scenario: Back navigation returns to note list

- **WHEN** the user presses the back button or swipes back from the note editor
- **THEN** the app returns to the note list screen

---

### Requirement: Note list screen displays all notes fetched from the REST API

The note list screen SHALL fetch notes from `GET /api/notes` on mount. Each note SHALL be displayed with its title and last-modified timestamp. A loading skeleton SHALL be shown while the request is in flight. An error state SHALL be shown if the request fails.

#### Scenario: Notes load successfully

- **WHEN** the note list screen mounts and the API is reachable
- **THEN** all notes are displayed within 3 seconds

#### Scenario: Empty state shown when no notes exist

- **WHEN** `GET /api/notes` returns an empty array
- **THEN** an empty-state message and a "Create note" call-to-action are displayed

---

### Requirement: New note can be created from the mobile app

A "New note" action SHALL be available on the note list screen. Tapping it SHALL call `POST /api/notes`, then navigate to the editor for the newly created note.

#### Scenario: Create note and navigate to editor

- **WHEN** the user taps "New note"
- **THEN** a new note is created via the API and the editor opens for that note

---

### Requirement: Metro bundler is configured to resolve monorepo workspace packages

`apps/mobile/metro.config.js` SHALL set `watchFolders` to include the repository root and SHALL configure `resolver.nodeModulesPaths` so Metro can resolve packages from the root `node_modules` and from sibling workspaces.

#### Scenario: Metro resolves shared-types without symlink errors

- **WHEN** the Expo dev server is running
- **THEN** importing `@nodeira/shared-types` in mobile source files causes no Metro resolution error

---

### Requirement: Auth tokens are stored in Expo SecureStore

After a successful login, the JWT access token SHALL be stored using `expo-secure-store`. The stored token SHALL be attached as a `Bearer` header on all subsequent API calls. On logout, the token SHALL be deleted from SecureStore.

#### Scenario: Token persists across app restarts

- **WHEN** the user closes and reopens the app after logging in
- **THEN** the app restores the token from SecureStore and does not require re-login

#### Scenario: Logout clears token

- **WHEN** the user logs out
- **THEN** the token is removed from SecureStore and subsequent API calls receive 401 responses
