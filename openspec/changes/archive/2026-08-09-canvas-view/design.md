## Context

Nodeira's current architecture centers on notes as Yjs CRDT documents synced via Hocuspocus WebSocket. The canvas feature introduces a second first-class content type. Canvases are fundamentally different from notes: they are spatial data structures (positioned nodes + edges), not flowing prose. The JSON Canvas spec is a simple JSON file format, not a protocol — making CRDT-based sync unnecessary for v1.

The frontend already uses React Flow-compatible patterns: `@dnd-kit` for drag-and-drop, TanStack Router for file-based routes, Mantine v9 for UI, and module-level Yjs context for editor state. Canvas will follow the same module patterns without Yjs.

## Goals / Non-Goals

**Goals:**

- Infinite canvas with five node types matching the JSON Canvas spec (text, file/note, link/web-preview, group, + image extension)
- Edges with optional labels and arrow styles
- Server-side OG metadata proxy for web preview nodes
- Debounced auto-save to PostgreSQL via REST
- Canvas embeddable in TipTap notes as an inline read-only block
- Dedicated sidebar nav section (Canvases) parallel to Graph, Quick Notes, Tags

**Non-Goals:**

- Real-time multi-user collaboration on canvases (no Yjs/Hocuspocus for v1)
- Full web page screenshot capture (Puppeteer / headless Chrome)
- Canvas-to-note conversion or export
- Offline-first persistence for canvases (no IndexedDB sync; page refresh loses unsaved changes only if save is pending)

## Decisions

### 1. Canvas stored as JSON, not Yjs

**Decision:** `data Json` column in PostgreSQL, REST save, not Hocuspocus.

**Rationale:** JSON Canvas spec is a static file format. The entire canvas is replaced on each save — no merge semantics are needed for single-user editing. Avoiding Yjs eliminates ~300 lines of provider boilerplate and a new WebSocket document namespace. Collaborative editing can be layered on later by storing `yjsState Bytes` alongside `data` and promoting the WebSocket path.

**Alternative considered:** Encode canvas nodes as a `Y.Map` — rejected because it forces a custom serialization layer between JSON Canvas spec and Yjs types, making interoperability harder.

### 2. React Flow (`@xyflow/react`) as canvas library

**Decision:** Use `@xyflow/react` v12 for the infinite canvas renderer.

**Rationale:** React Flow's data model (`nodes[]`, `edges[]`) is a 1:1 match to the JSON Canvas spec. It ships with pan/zoom, drag-to-move, snap-to-grid, and `onConnect` for edge creation out of the box. The graph view already ships `react-force-graph-2d` for a different use case; React Flow is purpose-built for static node/edge canvases with interaction.

**Alternative considered:** Build on Canvas API or `react-konva` — rejected because it requires implementing all interaction primitives manually.

### 3. Web preview via server-side OG metadata proxy

**Decision:** `POST /api/v1/canvases/preview` fetches the target URL, parses HTML for OG/meta tags, and returns structured metadata. No Chromium.

**Rationale:** Full-page screenshots require Puppeteer (150MB+ Chromium binary), which is a significant operational burden and Docker image size increase. For a link card on a canvas, OG metadata (title, description, og:image, favicon) provides sufficient visual context. The `og:image` is served by the origin server — we proxy its URL through the API, not download and re-host it (unless explicitly requested later).

**Alternative considered:** Client-side fetch — rejected because most sites set `Access-Control-Allow-Origin` headers that block cross-origin requests from the browser.

### 4. Canvas embedded in TipTap as a custom node

**Decision:** `CanvasEmbed` TipTap extension with a `canvasId` attribute. Renders a read-only React Flow miniature. Double-click opens the full canvas route.

**Rationale:** Consistent with `PdfEmbed` (existing custom node). Stored as `<canvas-embed canvasId="..."></canvas-embed>` in the Yjs ProseMirror doc. The miniature is interactive (pan only) so the user can orient themselves.

**Serialization:** The `canvasId` is written into the Yjs/ProseMirror document alongside regular note content. Backlink extraction in `HocuspocusService.onStoreDocument` should be extended later to detect `canvasEmbed` nodes and create Canvas → Note references if needed (not in scope for v1).

### 5. Canvases scoped to Vaults (not Folders for v1)

**Decision:** `Canvas` has an optional `vaultId` but no folder hierarchy UI for v1.

**Rationale:** Notes can be inside folders; implementing the full folder tree for canvases is duplicated effort. Vault scoping is needed for API token restrictions. Folder support can be added as a follow-up by wiring up the existing `folderId` column (it's in the schema from day one).

## Risks / Trade-offs

| Risk                                                                        | Mitigation                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Large canvas data causes slow saves                                         | Debounce auto-save at 1500ms; consider partial node updates in a v2   |
| `og:image` URLs may be relative or inaccessible after fetch                 | Normalize relative URLs against base URL; skip image if fetch fails   |
| React Flow bundle size (~200KB gzip) increases web app load time            | Code-split the canvas route with `React.lazy`                         |
| Canvas route not auto-discovered by TanStack Router if file naming is wrong | File must follow exact naming convention: `canvas.$canvasId.tsx`      |
| ProseMirror node conflicts if `CanvasEmbed` node name collides              | Name the TipTap extension `canvasEmbed` (camelCase, unique in schema) |

## Migration Plan

1. Run `prisma db push` to create the `canvases` table (no migration file needed for dev)
2. Deploy updated API with `CanvasModule` registered in `AppModule`
3. Deploy updated frontend with new routes and sidebar entry
4. No data migration required — feature is entirely additive

### 6. Canvas list shows live client-side thumbnail

**Decision:** Render a small non-interactive `<ReactFlow>` instance inside each canvas card on the list page.

**Rationale:** Server-side canvas rendering would require a headless browser or a custom SVG renderer — both are out of scope. Since the list query already returns `data`, we can reuse the same React Flow component in a scaled-down, `pointer-events: none` container. The thumbnail is "live" in the sense that it reflects the actual canvas node layout without any extra API calls.

**Trade-off:** Each canvas card mounts a React Flow instance. For lists with many canvases this could be heavy; cap list page display at ~20 items per page, and use `React.lazy` + `IntersectionObserver` to defer thumbnail mount until the card is visible.

### 7. Canvases included in sidebar search

**Decision:** Extend `GET /api/v1/canvases` to accept a `?q=` query param for title search. Frontend sidebar search fires a parallel query for canvases alongside the existing notes query and merges results, showing canvases with a distinct icon.

**Rationale:** Minimal backend change (one `WHERE title ILIKE` clause). Frontend already has a search results list component that can be extended with a typed result row.

### 8. Deleted-note placeholder in NoteCardNode

**Decision:** When a `NoteCardNode`'s `file` field references a note ID that returns 404 or is absent from the notes list, the card renders a muted "Note deleted" placeholder (grey background, strikethrough title, disabled double-click).

**Rationale:** Silently broken cards are confusing. A visible placeholder makes the stale reference obvious without blocking the rest of the canvas.

## Open Questions

<!-- All previously open questions have been resolved above -->
