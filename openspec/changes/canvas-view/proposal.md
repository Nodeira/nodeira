## Why

Nodeira has a rich note graph but no spatial, visual-thinking layer. A canvas view lets users arrange notes, images, web previews, and freestanding cards on an infinite board and draw explicit connections between them — turning the note graph into something you can reason about visually. The JSON Canvas spec provides an open, interoperable storage format.

## What Changes

- Add a new **Canvas** entity (database model + REST API) that stores a JSON Canvas spec document
- Add a dedicated **Canvases** section in the app (route `/canvases` for list, `/canvas/:id` for editor)
- Canvas editor renders an infinite canvas with five node types: text card, note reference, image, web page preview, and group
- Users can draw labeled connections (edges) between any two nodes
- Web page preview nodes fetch Open Graph metadata server-side (proxy endpoint, no Chromium)
- Canvases can be **embedded inside TipTap notes** as an inline block (read-only preview, click to open)
- Canvas data follows the [JSON Canvas spec](https://jsoncanvas.org/) with one extension: an `"image"` node type for uploaded assets

## Capabilities

### New Capabilities

- `canvas-crud`: REST API for creating, listing, updating, and deleting canvases; stores `data` as a JSON Canvas spec document in PostgreSQL
- `canvas-editor`: Infinite-canvas UI built on React Flow (`@xyflow/react`) supporting five node types, edge connections, pan/zoom, drag-to-place, and debounced auto-save
- `canvas-web-preview`: Server-side proxy endpoint that fetches a URL and returns Open Graph metadata (title, description, image, favicon) for WebPreviewNode cards
- `canvas-embed`: Custom TipTap extension `CanvasEmbed` that renders an inline read-only canvas miniature inside a note

### Modified Capabilities

<!-- No existing spec-level requirements are changing -->

## Impact

- **Database**: New `canvases` table; `Vault` and `Folder` models gain `canvases` relations
- **API**: New `CanvasModule` at `/api/v1/canvases`; new preview sub-endpoint
- **Frontend**: New routes, ~15 new components, one new TipTap extension; sidebar gains Canvases nav item
- **Dependencies**: `@xyflow/react` added to `apps/web`; `cheerio` or `node-html-parser` added to `apps/api`
- **Shared types**: `packages/shared-types` gains Canvas/CanvasData/CanvasNode/CanvasEdge interfaces
