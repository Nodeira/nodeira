## 1. API Token — Database & Auth Guard

- [x] 1.1 Add `ApiToken` model to `apps/api/prisma/schema.prisma` (id, name, tokenHash, userId, vaultId?, createdAt, lastUsedAt?, expiresAt?) with relation to `User`
- [x] 1.2 Run `prisma db push` (dev) to apply the new model and verify the table is created
- [x] 1.3 Create `apps/api/src/auth/dto/create-token.dto.ts` with `name`, optional `vaultId`, optional `expiresAt`
- [x] 1.4 Create `apps/api/src/auth/api-token.service.ts` — methods: `create(userId, dto)` (generates `ndra_` token, stores SHA-256 hash, returns raw token once), `findAll(userId)`, `revoke(id, userId)`, `validateToken(raw)` (hash + DB lookup + expiry check, returns `{ userId, vaultScope }`)
- [x] 1.5 Create `apps/api/src/auth/guards/api-token.guard.ts` — detects `ndra_` prefix, calls `validateToken`, attaches `{ ...user, vaultScope: string | null }` to `req.user`
- [x] 1.6 Update `apps/api/src/auth/guards/jwt-auth.guard.ts` (or create a combined `auth.guard.ts`) to try API token guard first when Bearer prefix is `ndra_`, fall back to JWT otherwise
- [x] 1.7 Add `POST /auth/tokens`, `GET /auth/tokens`, `DELETE /auth/tokens/:id` endpoints to `auth.controller.ts`
- [x] 1.8 Register `ApiTokenService` in `AuthModule` and add `PrismaService` dependency if not already present

## 2. Vault Scope Enforcement (Server)

- [x] 2.1 Update `NotesService.findAll` to accept optional `vaultScope: string | null`; if set, force `vaultId` filter to `vaultScope` regardless of caller's param
- [x] 2.2 Update `NotesService.findOne` to accept `vaultScope` and throw 403 if `note.vaultId !== vaultScope`
- [x] 2.3 Update `NotesService.create` to accept `vaultScope` and throw 403 if `dto.vaultId !== vaultScope`
- [x] 2.4 Update `NotesService.update` and `remove` to accept `vaultScope` and validate note vault before mutation
- [x] 2.5 Update `NotesController` to extract `req.user.vaultScope` and pass it to all service calls
- [x] 2.6 Update `FoldersService.findAll` to filter by `vaultScope` when set; update `FoldersController` similarly
- [x] 2.7 Update `VaultsService.findAll` to filter to `[vaultScope]` when set; update `VaultsController` similarly
- [x] 2.8 Smoke-test vault scope enforcement: create a vault-scoped token, confirm 403 on cross-vault note access

## 3. Markdown Conversion Service (Server)

- [x] 3.1 Add deps to `apps/api/package.json`: `remark`, `remark-parse`, `remark-stringify`, `unist-util-visit`, `@tiptap/y-tiptap` (check monorepo for exact version from web app)
- [x] 3.2 Create `apps/api/src/notes/markdown-converter.service.ts` with `markdownToYjsState(markdown: string): Promise<Uint8Array>` and `yjsStateToMarkdown(state: Uint8Array): Promise<string>`
- [x] 3.3 Implement MDAST → TipTap JSON mapper in the converter service, covering: `heading` (h1-h3), `paragraph`, `strong` (bold), `emphasis` (italic), `inlineCode` (code mark), `code` (codeBlock + language), `list` (bulletList/orderedList), `listItem`, `blockquote`, `thematicBreak` (horizontalRule), `link`
- [x] 3.4 Implement TipTap JSON → MDAST serializer (reverse of 3.3) covering the same node set
- [x] 3.5 Use `@tiptap/y-tiptap`'s `TiptapTransformer.toYdoc()` to convert TipTap JSON → Y.Doc, then `Y.encodeStateAsUpdate()` for the write path
- [x] 3.6 Use `@tiptap/y-tiptap`'s `TiptapTransformer.fromYdoc()` to extract TipTap JSON from a Y.Doc (after `applyUpdate`) for the read path
- [x] 3.7 Write unit tests for the converter: heading round-trip, bold/italic marks, code block with language, nested list, blockquote, link

## 4. Note Content Endpoints (Server)

- [x] 4.1 Add `getContent(id, vaultScope?)` and `setContent(id, markdown, vaultScope?)` methods to `NotesService` — `getContent` calls `yjsStateToMarkdown`; `setContent` calls `markdownToYjsState` then upserts `yjsState`
- [x] 4.2 Add `GET :id/content` and `PUT :id/content` routes to `NotesController`; extract `vaultScope` from `req.user` and pass through; `PUT` body DTO: `{ content: string }`
- [x] 4.3 Verify `GET /notes/:id/content` returns `{ content: "" }` for notes with null `yjs_state`
- [x] 4.4 Verify content written via `PUT` is readable back via `GET` with correct Markdown round-trip

## 5. Go CLI — Project Scaffold

- [x] 5.1 Create `apps/cli/` directory with `go.mod` (module `github.com/Nodeira/nodeira/cli`, Go 1.22+)
- [x] 5.2 Add `cobra` and `viper` dependencies (`go get github.com/spf13/cobra github.com/spf13/viper`)
- [x] 5.3 Create `apps/cli/main.go` entry point and `apps/cli/cmd/root.go` with persistent `--pretty` flag and config/env loading
- [x] 5.4 Implement config file logic in `cmd/root.go`: read/write `~/.config/nodeira/config.json`; env vars `NODEIRA_URL` and `NODEIRA_TOKEN` override config; `NODEIRA_MODE=ro` sets a global RO flag
- [x] 5.5 Implement RO mode guard helper used by all write commands: print error to stderr, exit code 2
- [x] 5.6 Add a `turbo.json` task entry for the CLI build: `go build -o dist/nodeira ./...` in `apps/cli/`

## 6. Go CLI — Auth & Token Commands

- [x] 6.1 Implement `cmd/login.go` — `nodeira login` (interactive prompts for URL, email, password; calls `POST /api/auth/login`; stores token to config) and `nodeira login --token <value>` (stores token directly)
- [x] 6.2 Implement `cmd/token.go` — `nodeira token create --name <n> [--vault <id>] [--expires <duration>]`; calls `POST /api/auth/tokens`; prints raw token with warning it won't be shown again
- [x] 6.3 Implement `nodeira token list` — calls `GET /api/auth/tokens`; formats as JSON or `--pretty` table
- [x] 6.4 Implement `nodeira token revoke <id>` — calls `DELETE /api/auth/tokens/:id`; blocked in RO mode

## 7. Go CLI — Notes Commands

- [x] 7.1 Implement `cmd/notes.go` — `nodeira notes list [--vault <id>] [--folder <id>]`; calls `GET /api/notes`
- [x] 7.2 Implement `nodeira notes get <id> [--content]`; calls `GET /api/notes/:id` and optionally `GET /api/notes/:id/content`; merges `content` field into output JSON
- [x] 7.3 Implement `nodeira notes create --title <t> [--vault <id>] [--folder <id>] [--content <text>|--content-file <path>|-]`; creates note then calls `PUT /api/notes/:id/content` if content provided; blocked in RO mode
- [x] 7.4 Implement `nodeira notes update <id> [--title <t>] [--content <text>|--content-file <path>|-]`; calls `PATCH /api/notes/:id` for metadata and `PUT /api/notes/:id/content` for body; blocked in RO mode
- [x] 7.5 Implement `nodeira notes delete <id>`; calls `DELETE /api/notes/:id`; blocked in RO mode

## 8. Go CLI — Folders, Vaults & Config Commands

- [x] 8.1 Implement `cmd/folders.go` — `nodeira folders list [--vault <id>]`; calls `GET /api/folders`
- [x] 8.2 Implement `cmd/vaults.go` — `nodeira vaults list`; calls `GET /api/vaults`
- [x] 8.3 Implement `cmd/config.go` — `nodeira config set-url <url>`; writes URL to config file

## 9. CI — Build & Release

- [x] 9.1 Add GitHub Actions job to `.github/workflows/release.yml` (or a new `cli.yml`) that cross-compiles the CLI for `linux/amd64`, `darwin/amd64`, `darwin/arm64`, `windows/amd64` on tagged releases
- [x] 9.2 Attach compiled binaries as release assets using `softprops/action-gh-release` or equivalent
- [x] 9.3 Add `apps/cli/` to the Turborepo `turbo.json` pipeline so `pnpm run build` also builds the CLI
