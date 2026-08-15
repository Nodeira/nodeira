## 1. Shared Types

- [x] 1.1 Create `packages/shared-types/src/types/canvas.ts` with `CanvasNodeBase`, `TextCanvasNode`, `FileCanvasNode`, `LinkCanvasNode`, `ImageCanvasNode`, `GroupCanvasNode`, `CanvasNode`, `CanvasEdge`, `CanvasData`, `OgPreview`, and `Canvas` interfaces
- [x] 1.2 Export canvas types from `packages/shared-types/src/index.ts`

## 2. Backend — Database

- [x] 2.1 Add `Canvas` model to `apps/api/prisma/schema.prisma` with fields: `id`, `title`, `vaultId`, `folderId`, `data Json`, `pinned`, `icon`, `position`, `createdAt`, `updatedAt`
- [x] 2.2 Add `canvases Canvas[]` relation field to `Vault` model in schema
- [x] 2.3 Add `canvases Canvas[]` relation field to `Folder` model in schema
- [x] 2.4 Run `prisma db push` to apply the schema

## 3. Backend — Canvas Module

- [x] 3.1 Create `apps/api/src/canvas/dto/create-canvas.dto.ts` with optional `title`, `vaultId`, `folderId`
- [x] 3.2 Create `apps/api/src/canvas/dto/update-canvas.dto.ts` with optional `title`, `data`, `pinned`, `icon`, `position`
- [x] 3.3 Create `apps/api/src/canvas/canvas.service.ts` with `findAll(vaultId?, q?)`, `findOne(id)`, `create(dto)`, `update(id, dto)`, `remove(id)` methods using `PrismaService`; `findAll` filters by `title ILIKE %q%` when `q` is present; enforce vault scoping via the auth token
- [x] 3.4 Create `apps/api/src/canvas/canvas.controller.ts` with `GET /` (accepts `?vaultId` and `?q` query params), `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` routes (JWT guard, mirrors `notes.controller.ts` patterns)
- [x] 3.5 Add `POST /preview` endpoint in the canvas controller that accepts `{ url: string }` and delegates to a `fetchUrlPreview` method
- [x] 3.6 Implement `fetchUrlPreview` in `canvas.service.ts`: fetch URL with 5s timeout, parse HTML with `node-html-parser` (add dependency), extract OG tags + title + favicon, resolve relative URLs, return `OgPreview` or throw 422 on failure
- [x] 3.7 Create `apps/api/src/canvas/canvas.module.ts` importing `DatabaseModule`, declaring controller and service
- [x] 3.8 Register `CanvasModule` in `apps/api/src/app.module.ts`
- [x] 3.9 Add `node-html-parser` to `apps/api/package.json` and install

## 4. Frontend — Dependencies and API Layer

- [x] 4.1 Add `@xyflow/react` to `apps/web/package.json` and install
- [x] 4.2 Add canvas query key factory and `getCanvases(vaultId?, q?)`, `getCanvas`, `createCanvas`, `updateCanvas`, `deleteCanvas`, `fetchUrlPreview` functions to `apps/web/src/lib/api.ts`
- [x] 4.3 Add `activeCanvasIdAtom` to `apps/web/src/store/atoms.ts`

## 5. Frontend — Canvas Editor Core

- [x] 5.1 Create `apps/web/src/components/canvas/CanvasView.tsx`: `<ReactFlow>` wrapper with `nodeTypes`, `edgeTypes`, dot-grid background, `onNodesChange`, `onEdgesChange`, `onConnect` handlers; accepts `canvasData` prop and `onChange` callback
- [x] 5.2 Create `apps/web/src/components/canvas/CanvasToolbar.tsx`: floating panel with "Text", "Note", "Image", "Link", "Group" add-node buttons and a save-status indicator ("Saved" / "Saving…")
- [x] 5.3 Create `apps/web/src/components/canvas/CanvasContextMenu.tsx`: right-click context menu on canvas background with the same node-type options, positioned at cursor coordinates

## 6. Frontend — Canvas Node Components

- [x] 6.1 Create `apps/web/src/components/canvas/nodes/TextCardNode.tsx`: Mantine `Paper` card with a markdown textarea; single-click selects, double-click enters edit mode, click-away saves
- [x] 6.2 Create `apps/web/src/components/canvas/nodes/NoteCardNode.tsx`: shows note title (bold) and content preview (2–3 lines); double-click opens note in editor; when note ID resolves to nothing renders a muted grey card with strikethrough title, "Note deleted" subtitle, and double-click disabled
- [x] 6.3 Create `apps/web/src/components/canvas/nodes/ImageNode.tsx`: renders `<img>` from `url` field; respects node width/height from canvas data
- [x] 6.4 Create `apps/web/src/components/canvas/nodes/WebPreviewNode.tsx`: favicon + title row, description (2-line clamp), og:image as header if present; single-click opens URL in new tab
- [x] 6.5 Create `apps/web/src/components/canvas/nodes/GroupNode.tsx`: transparent Mantine `Paper` with a dashed border and editable label; acts as a visual container (no React Flow parent/child grouping needed for v1)
- [x] 6.6 Create `apps/web/src/components/canvas/CanvasEdge.tsx`: custom edge using React Flow's `EdgeLabelRenderer`; double-click on edge reveals inline label input; supports `color` from edge data

## 7. Frontend — Modals

- [x] 7.1 Create `apps/web/src/components/canvas/AddNoteModal.tsx`: search input that filters notes via existing `getCanvases`/`getNotes` API; selecting a note closes modal and returns the chosen note to `CanvasView` for node creation
- [x] 7.2 Create `apps/web/src/components/canvas/AddLinkModal.tsx`: URL text input with a "Preview" button that calls `fetchUrlPreview`; shows preview card before confirming; submitting returns `OgPreview` to `CanvasView`

## 8. Frontend — Routes

- [x] 8.1 Create `apps/web/src/routes/_authenticated/canvases.tsx`: list page using `useQuery(canvasKeys.all, getCanvases)`; `SimpleGrid` of canvas cards with title, icon, date, and a lazy-mounted read-only `<CanvasView>` thumbnail (use `IntersectionObserver` to defer mount; show grid placeholder if `data.nodes` is empty); "New Canvas" button; delete context menu on each card
- [x] 8.2 Create `apps/web/src/routes/_authenticated/canvas.$canvasId.tsx`: loads canvas with `useQuery(canvasKeys.detail(canvasId), () => getCanvas(canvasId))`; renders `<CanvasView>` and `<CanvasToolbar>`; wires debounced auto-save (1500ms) via `useMutation(updateCanvas)`

## 9. Frontend — Sidebar Integration

- [x] 9.1 Add "Canvases" nav link to `apps/web/src/components/sidebar/Sidebar.tsx` pointing to `/canvases`, styled consistently with Graph, Quick Notes, and Tags links (same icon size, same indent level)
- [x] 9.2 Extend the sidebar search logic to fire a parallel `getCanvases({ q })` query alongside the existing notes search; merge canvas results into the search dropdown with a canvas icon (e.g., `IconLayout`) and navigate to `/canvas/:id` on selection

## 10. Frontend — CanvasEmbed TipTap Extension

- [x] 10.1 Create `apps/web/src/components/CanvasEmbed.tsx`: TipTap `Node.create` extension named `canvasEmbed` with `canvasId` attribute; `NodeViewWrapper` renders a bounded `<CanvasView readOnly>` at 300px height; double-click navigates to `/canvas/:canvasId`; shows placeholder if canvas not found
- [x] 10.2 Register `CanvasEmbed` in the `extensions` array in `apps/web/src/components/NoteEditor.tsx`
- [x] 10.3 Add a "Embed Canvas" toolbar button or slash command entry in `NoteEditor.tsx` that opens a canvas-picker modal and inserts the `canvasEmbed` node

## 11. Verification

- [x] 11.1 Run `pnpm exec turbo run typecheck` — no TypeScript errors across all packages
- [x] 11.2 Navigate to `/canvases`, create a new canvas — verify it persists after page reload
- [x] 11.3 Add a TextCardNode, edit its content, verify debounced save works
- [x] 11.4 Add a NoteCardNode via the Note modal, double-click to open the note
- [x] 11.5 Add a WebPreviewNode, verify OG preview renders (title + image)
- [x] 11.6 Upload an image via the Image button, verify ImageNode renders
- [x] 11.7 Draw an edge between two nodes, add a label via double-click — **fixed.** The label's double-click target (`CanvasEdge.tsx`) rendered `null` when `label` was empty, giving it a 0×0 bounding box that could never be hit. Now given a `minWidth`/`minHeight` of 16px regardless of content. Verified: hit box went from 0×0 to 32×32, and a label typed and committed now persists across reload.
- [x] 11.8 Open a note, embed a canvas via the toolbar, verify the miniature renders in read-only mode and double-click navigates to the full canvas — **fixed.** `ReadOnlyCanvas.tsx` rendered `CanvasView readOnly` without disabling React Flow's default `zoomOnDoubleClick`, so the pane consumed most double-clicks as a zoom before they could bubble to `CanvasEmbed.tsx`'s navigate handler. `CanvasView` now passes `zoomOnDoubleClick={!readOnly}`. Verified: double-clicking an embedded canvas in a note navigates straight to `/canvas/:id`.
- [x] 11.9 On the canvases list page, verify each card shows a thumbnail matching the actual canvas node layout; verify empty canvases show the placeholder
- [x] 11.10 Type a canvas title in the sidebar search bar, verify the canvas appears in results with a canvas icon; clicking navigates to `/canvas/:id`
- [x] 11.11 Place a NoteCardNode referencing a note, then delete that note via the API; reload the canvas and verify the card shows the "Note deleted" placeholder state

**Also found and fixed, not part of the original checklist:** every toolbar-triggered "Add" (text/note/link/image/group) that isn't placed via right-click landed at the same fixed flow position (100, 100), so successive additions stacked exactly on top of each other — no data loss (dragging one aside revealed the other), but looked like data loss until you did. `CanvasEditor.tsx`'s `addNodeViaRef` now cascades each such add by 24px, wrapping after 8. Verified: two toolbar-added nodes now land visibly offset rather than stacked.
