## Context

Nodeira stores note content as Yjs CRDT binary state (`BYTEA` in Postgres), synced over WebSocket via Hocuspocus. The REST API handles only note metadata (title, vault, folder, position). There is no authentication path suitable for long-running agent sessions — only email/password login producing short-lived JWTs.

The web app uses TipTap v3 + `@tiptap/y-tiptap` to bind its editor to Yjs. TipTap's Yjs fragment (`default`) stores ProseMirror nodes as `Y.XmlElement` trees with TipTap's camelCase node names (`bulletList`, `codeBlock`, `hardBreak`, etc.), which differ from stock ProseMirror snake_case names.

## Goals / Non-Goals

**Goals:**

- Long-lived API tokens with optional vault-level scope, revocable without re-login
- `GET /notes/:id/content` and `PUT /notes/:id/content` that speak Markdown, not binary Yjs
- A single self-contained Go binary (`nodeira`) usable by AI agents and humans
- RO/RW mode enforced at the CLI level via env var

**Non-Goals:**

- Real-time Yjs WebSocket client in the CLI (proper CRDT merge when browser is simultaneously editing)
- Markdown support for tables, task lists, images, or strikethrough in v1
- Server-side enforcement of RO mode (CLI advisory enforcement is sufficient for v1)
- Multi-user token management (tokens are per-user; no admin revocation of other users' tokens)

## Decisions

### D1: API tokens as opaque `ndra_` strings, stored as SHA-256 hashes

**Decision:** Tokens are random 32-byte hex strings with an `ndra_` prefix. The raw token is returned once on creation and never stored. The DB stores only the SHA-256 hash. Auth guard hashes the incoming Bearer value and looks it up.

**Alternatives considered:**

- _Long-lived JWT with `jti` claim_: Avoids the DB lookup per request, but revocation requires a denylist anyway — same DB hit, worse ergonomics.
- _bcrypt hash_: Correct for passwords (timing safety), wrong here — bcrypt is slow by design; SHA-256 is fine for a random 32-byte token (no brute-force surface).

**Rationale:** One DB lookup per API-token request is acceptable. SHA-256 of a 256-bit random token is cryptographically safe. The `ndra_` prefix makes tokens grep-able in logs and configs if one leaks.

### D2: Vault scope enforced in service layer, attached via request decorator

**Decision:** `ApiTokenGuard` attaches `vaultScope: string | null` to `req.user`. Each service method that touches notes/folders/vaults accepts an optional `vaultScope` parameter and applies it as an additional `WHERE` filter or a 403 guard.

**Alternatives considered:**

- _Interceptor that post-filters responses_: Leaks data before filtering; wrong approach for security.
- _Separate `VaultScopeGuard` per route_: Requires every controller to remember to apply it; service-layer enforcement is more auditable.

**Rationale:** Services are the right enforcement layer. The guard does identity + scope extraction; services do scope application. Controllers pass `req.user.vaultScope` through to the service.

### D3: Markdown ↔ Yjs via remark MDAST + custom TipTap mapper + `@tiptap/y-tiptap`

**Decision:** Three-stage pipeline:

1. `remark-parse` → MDAST (proven Markdown parser, no DOM dependency)
2. Custom MDAST → TipTap JSON mapper (covers the StarterKit node set with correct camelCase names)
3. `@tiptap/y-tiptap`'s `TiptapTransformer.toYdoc()` / `fromYdoc()` (already a monorepo dep, handles the Y.XmlFragment encoding correctly)

**Alternatives considered:**

- _`prosemirror-markdown` + `y-prosemirror`_: `prosemirror-markdown` uses snake_case node names; `y-prosemirror` would write the wrong element names to the Yjs fragment, breaking the browser editor.
- _`@tiptap/extension-markdown` server-side_: Browser extension; server-side support is unofficial and untested.
- _Hand-rolled Markdown parser_: Eliminates the `remark` dep but trades a proven parser for a fragile custom one. Not worth it.

**Rationale:** The key constraint is that TipTap's Yjs fragment uses camelCase node names. `@tiptap/y-tiptap` is the authoritative bridge and is already in the monorepo. Using `remark` for parsing gives us a correct MDAST; the custom mapper is small (~150 lines) and covers only the nodes we support.

### D4: Direct DB write for content, with documented concurrent-edit limitation

**Decision:** `PUT /notes/:id/content` encodes to Yjs and writes directly to `notes.yjs_state`. It does not interact with Hocuspocus's in-memory state.

**Risk:** If a browser has the note open, Hocuspocus's next `onStoreDocument` call will overwrite the CLI write. This is documented behavior.

**Rationale:** Wiring up a full Yjs WebSocket client in the content endpoint (to merge CRDTs properly) is significant complexity for an edge case. The primary use case is agents writing when no browser session is active.

### D5: Go for the CLI, living in `apps/cli/` as a standalone Go module

**Decision:** The CLI is a Go module (`go.mod`) at `apps/cli/`. Turborepo coordinates its build via a `turbo.json` task that shells out to `go build`. CI cross-compiles for `linux/amd64`, `darwin/amd64`, `darwin/arm64`, `windows/amd64` and attaches binaries to GitHub releases.

**Alternatives considered:**

- _TypeScript + Node `pkg`_: `pkg` is largely unmaintained; no clean self-contained binary story without Bun.
- _TypeScript + Bun compile_: Project moved away from Bun.

**Rationale:** Go produces small (~8MB), self-contained, cross-compiled binaries with no runtime dependency. Cobra + Viper is the gold standard for this CLI shape. The extra language in the repo is an acceptable trade-off for a CLI tool with no shared runtime code with the server.

## Risks / Trade-offs

- **Concurrent browser edit clobbers CLI write** → Documented limitation; mitigated by the fact that agents write when no browser is open. Future fix: proper Yjs WebSocket client in the CLI.
- **MDAST → TipTap JSON mapper is custom code** → Limited Markdown surface (no tables, task lists, images). If TipTap node names change in a future version, the mapper needs updating. Mitigated by the small surface area and test coverage.
- **SHA-256 token lookup on every API-token request** → One indexed DB read; negligible at Nodeira's scale.
- **`@tiptap/y-tiptap` API stability** → It's already a production dep in the web app, so changes would be caught by the web build anyway.

## Migration Plan

1. Deploy server with new Prisma migration (`api_tokens` table). No data migration needed — new table only.
2. Existing JWT-based auth is unchanged. No breaking API changes.
3. Release CLI binary via GitHub release; users download or install via script.

## Open Questions

- Should `expiresAt` default to something (e.g., 1 year) or be truly optional (never-expiring)? Current design: optional (null = never expires).
- Should the `--expires` CLI flag accept Go duration strings (`30d`, `1y`) or ISO dates? Leaning toward human-friendly duration strings.
