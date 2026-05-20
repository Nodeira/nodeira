## Why

Nodeira's core value proposition is that AI agents can use it as a persistent "mind" — but currently there is no way for an agent (or a human on the command line) to read or write notes without a browser. This change adds a Go CLI and the server-side capabilities it depends on: API token auth (with vault-level scoping) and Markdown content read/write over Yjs.

## What Changes

- **New Go CLI** (`apps/cli/`) — `nodeira` binary with commands for managing notes, folders, vaults, and API tokens. Usable by AI agents (JSON output, env-var auth, RO/RW mode enforcement) and humans (interactive login, `--pretty` tables).
- **API token auth** — long-lived `ndra_...` tokens stored hashed in a new `api_tokens` table. Tokens can be scoped to a single vault, restricting all note/folder/vault operations to that vault.
- **Note content endpoints** — `GET /notes/:id/content` and `PUT /notes/:id/content` expose Markdown over the existing Yjs binary state, using `remark` + a custom MDAST↔TipTap JSON mapper + `@tiptap/y-tiptap` for the Yjs bridge.

## Capabilities

### New Capabilities

- `api-token-auth`: Create, list, and revoke long-lived API tokens with optional vault-level scope; server-side guard validates tokens and enforces vault restrictions on all note/folder/vault endpoints.
- `note-content-api`: REST endpoints to read and write note body content as Markdown, converting to/from Yjs binary state server-side.
- `nodeira-cli`: Go CLI binary (`apps/cli/`) for agents and users to manage notes, folders, vaults, and API tokens against a Nodeira server instance.

### Modified Capabilities

## Impact

- **Server (`apps/api`)**: New Prisma model (`ApiToken`), new migration, new auth module endpoints, new `NoteContentController`, new `MarkdownConverterService`. New deps: `remark`, `remark-parse`, `remark-stringify`, `unist-util-visit`, `@tiptap/y-tiptap` (already in monorepo).
- **CLI (`apps/cli/`)**: New Go module, new `turbo.json` task for `go build`, new CI job to cross-compile and attach binaries to GitHub releases.
- **Database**: One new table (`api_tokens`), one new Prisma migration.
- **API surface**: Two new note endpoints (`GET|PUT /notes/:id/content`), three new auth endpoints (`POST|GET|DELETE /auth/tokens`). No breaking changes to existing endpoints.
