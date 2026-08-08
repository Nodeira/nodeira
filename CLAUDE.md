# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nodeira is an Obsidian-like, AI-enhanced note-taking application. Key differentiator: AI can read/write notes via the `nodeira` CLI, making it usable as an AI "mind" for storing application state during software development workflows.

**Early development.** No production deployments exist yet; breaking changes are acceptable.

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Backend (`apps/api`):** NestJS 10, Prisma ORM, PostgreSQL, Hocuspocus (Yjs WebSocket server)
- **Frontend (`apps/web`):** React 19, Vite 6, TanStack Router (file-based), TanStack Query v5, Mantine v9, Jotai, TipTap + Yjs
- **Desktop (`apps/desktop`):** Electron Forge 7 + Vite, better-sqlite3 for local persistence
- **Mobile (`apps/mobile`):** native Android (Kotlin/Jetpack Compose, Gradle). Not a pnpm workspace member — no `package.json`
- **CLI (`apps/cli`):** Go + Cobra. The AI-facing interface
- **Docs (`apps/docs`):** Docusaurus 3
- **E2E (`apps/e2e`):** Playwright
- **Shared:** `packages/shared-types`, `packages/eslint-config`

## Commands

```bash
pnpm install                          # install all workspace deps
pnpm run dev                          # all dev servers (web :5173, api :3001, docs :3002)
pnpm run build                        # build all packages (needs Go for apps/cli)
pnpm run typecheck                    # type-check every package
pnpm run lint
pnpm run test                         # API tests — REQUIRES DOCKER (Testcontainers)
pnpm run test:e2e                     # Playwright
pnpm run db:up                        # start the dev Postgres container
pnpm run db:wipe                      # drop + recreate the dev database
pnpm run mobile:run                   # build, install and launch the Android app
pnpm exec turbo run dev --filter=@nodeira/web     # a single dev server
```

**First-time setup** (PostgreSQL required):

```bash
pnpm run db:up
cp apps/api/.env.example apps/api/.env
# Set JWT_SECRET — the server refuses to boot without one of 32+ chars,
# and refuses to boot if it is still the .env.example placeholder.
cd apps/api && pnpm exec prisma migrate dev
```

**Schema changes use migrations** — `schema.prisma` is not applied directly. After editing it, run
`cd apps/api && pnpm exec prisma migrate dev --name <description>` and commit the generated file under
`apps/api/prisma/migrations/`. The server runs `prisma migrate deploy` on startup (see `prisma.service.ts`).
Do **not** use `prisma db push` (it drifts the DB from the migration history).

Migrations that change existing data need hand-written SQL — Prisma cannot infer intent. See
`20260808000000_multi_user_vault_membership` for the pattern, and test any such migration against both a
populated and an empty database before committing.

## Architecture

### Sync (the core design)

Yjs CRDTs power offline-first sync. Every note is a Yjs document:

```
Browser
  ├── TipTap editor        (display layer)
  ├── Y.Doc                (in-memory CRDT — source of truth)
  ├── y-indexeddb          (offline persistence; better-sqlite3 on desktop)
  └── @hocuspocus/provider (online sync → proxied through Vite → NestJS /sync/<noteId>)
          ↓
NestJS server (:3001)
  └── SyncGateway → HocuspocusService
      ├── onAuthenticate:   verifies the token AND authorizes the note, per connection
      ├── onLoadDocument:   reads yjsState from PostgreSQL, applies to Y.Doc
      └── onStoreDocument:  encodes Y.Doc state, writes back; derives links and tags
          ↓
PostgreSQL  (notes.yjs_state)
```

Authorization belongs in `onAuthenticate`, **not** `onLoadDocument`: Hocuspocus caches documents in
memory and only calls `onLoadDocument` on a cache miss, so a check there runs for the first connection
to a note and every later connection inherits it.

`onStoreDocument` writes with `updateMany`, which affects zero rows for a deleted note rather than
recreating it. That is deliberate — it is what stops deleted notes reappearing as ghosts.

### Authorization

**Vault membership is the single authorization primitive.** Notes, folders and canvases have no owner of
their own; they are reachable exactly when the caller is a member of their vault (`VaultMember`).

- `VaultAccessService` is the only place that answers "may this user touch this vault?". Use it; do not
  hand-roll checks in services.
- Non-members get **NotFound, not Forbidden** — whether a vault or note exists is itself information.
- API-token vault scope may only **narrow** what a user can reach, never widen it.
- `vaultId` is required on Note, Folder and Canvas. A row with no vault cannot be authorized against.
- Instance-wide roles (`Role`, ADMIN/USER) are enforced by `RolesGuard` via `@Roles()`. There is no public
  registration; `POST /users` is admin-only.

### NestJS server structure

- `DatabaseModule` — global Prisma provider
- `AuthModule` — **@Global**, because `JwtAuthGuard` (used by nearly every module) injects `ApiTokenService`
- `VaultsModule` — **@Global**, exports `VaultAccessService`
- `DocumentBridgeModule` — **@Global**, lets REST handlers mutate live Yjs documents through the sync
  server (`SyncModule` already imports `NotesModule`, so the reverse dependency would be circular)
- Feature modules: Notes, Folders, Canvas, Reminders, Plugins, Upload, Users, Setup, AppState, Sync

The WS adapter is raw WebSocket (`SyncWsAdapter`), NOT Socket.IO — Hocuspocus needs y-websocket framing.

`reflect-metadata` must be the **first import** in `apps/api/src/main.ts`. The API uses `module: "CommonJS"`
with `verbatimModuleSyntax: false` because NestJS decorators require CommonJS + emitDecoratorMetadata.

Routes live under **`/api/v1`** (`setGlobalPrefix("api")` + URI versioning, `defaultVersion: "1"`).

### Testing the API

Vitest transforms TypeScript with esbuild, which **cannot emit decorator metadata**. `apps/api/vitest.config.ts`
therefore runs `unplugin-swc` — without it `design:paramtypes` is undefined and Nest DI resolves every
constructor parameter to `undefined`, so nothing can be tested through the container.

Prefer building the real DI graph (`Test.createTestingModule`) over `new SomeService(...)`. The
`ApiTokenService` break that made every API-token request 500 was invisible precisely because every spec
constructed services by hand.

Tests use Testcontainers, so **Docker must be running**.

### Web app structure

- `src/providers/YjsProvider.ts` — module-level, **refcounted** cache of Yjs contexts. Not React state:
  docs must survive re-renders and route transitions. Use the `useYjsContext` hook rather than calling
  acquire/release by hand.
- `src/lib/useDeleteNote.ts` — the only way to delete a note. It tears down the Yjs context and drops the
  note's IndexedDB database; a bare `deleteNote()` call leaks both.
- `src/store/atoms.ts` — Jotai atoms (`currentVaultAtom`, pane sizing, `authUserAtom`, …)
- `src/routes/` — TanStack Router file-based routes. `routeTree.gen.ts` is auto-generated — do not edit.
- `src/lib/iconMap.ts` — **generated**; run `node apps/web/scripts/gen-icon-map.mjs` after editing
  `ICON_CATEGORIES`. Never `import("@tabler/icons-react")` dynamically: that barrel namespace-imports
  ~5,900 icons and cost a 3.7 MB chunk.
- Vite proxies `/api`, `/uploads` → `http://localhost:3001` and `/sync`, `/notifications` → ws.

**Query keys**: invalidate with `notesKeys.all`, never a vault-scoped key. TanStack matches by prefix, so
`["notes"]` refreshes the byVault entries but not the reverse — and `TabBar`, `BrowsePane`, `GraphView`
and `NoteEditor` all read `["notes"]`. Note that `setQueryData` does **not** prefix-match, so optimistic
writes must target both keys.

TipTap's `StarterKit` must be configured with `{ undoRedo: false }` when using Yjs — Yjs owns undo/redo.
(In TipTap 2 this option was named `history`.)

Mantine v9 requires explicit CSS imports in `main.tsx`.

## React Conventions

Avoid `useEffect` for derived state or event-driven logic (see `no-useeffect.md`):

- **Don't use Effects** to transform data for rendering or to handle user events
- **Do use Effects** to synchronize with external systems (WebSockets, browser APIs, IPC)

An effect that subscribes once (`[]` deps) must read handlers through a ref, or it captures first-render
state forever — that is how desktop "New Note" ended up always creating vault-less notes.

## UI

Use Mantine v9 components. `llms.txt` in the repo root contains Mantine v9 API documentation for LLM reference.

When using Mantine's polymorphic components (e.g. `NavLink`) with TanStack Router's `Link`, wrap `Link` as
the outer element rather than passing it via the `component` prop.

## Platform notes

- Development is on **Windows**; scripts that shell out must be cross-platform. Prefer Node scripts over
  `.sh` — a `bash` in a package script routes to WSL, which cannot see the Windows Docker context. See
  `scripts/mobile-run.mjs` and `scripts/wipe-db.mjs`.
- The Android editor is a **WebView** hosting the web build (there is no mature Kotlin Yjs library), so
  `apps/web/dist` ships inside the APK — web bundle size is a mobile concern too.
