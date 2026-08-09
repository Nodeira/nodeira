## ADDED Requirements

### Requirement: Infinite canvas with pan and zoom

The canvas editor SHALL render an infinite canvas using React Flow (`@xyflow/react`) that supports smooth panning (drag background) and zooming (scroll wheel / pinch). The canvas SHALL display a subtle dot-grid background that moves with the viewport.

#### Scenario: Pan canvas

- **WHEN** the user drags the canvas background
- **THEN** the viewport pans smoothly, nodes stay in their world-space positions

#### Scenario: Zoom canvas

- **WHEN** the user scrolls the mouse wheel over the canvas
- **THEN** the viewport zooms in or out centered on the cursor position

#### Scenario: Fit canvas to screen

- **WHEN** the canvas first loads
- **THEN** the viewport is fit to show all existing nodes (or centered at origin if empty)

### Requirement: Five node types

The canvas editor SHALL support five node types. All nodes SHALL be draggable to any position on the canvas. All nodes SHALL show resize handles when selected. Node dimensions SHALL be persisted in canvas data.

#### Scenario: Add text card node

- **WHEN** the user clicks "Text" in the canvas toolbar (or right-clicks the background and selects "Add Text Card")
- **THEN** a new `TextCardNode` is placed at the click/cursor position with empty markdown content and enters edit mode

#### Scenario: Edit text card

- **WHEN** the user double-clicks a `TextCardNode`
- **THEN** the node enters inline edit mode showing a markdown textarea; clicking outside saves the content

#### Scenario: Add note reference node

- **WHEN** the user clicks "Note" in the canvas toolbar
- **THEN** an `AddNoteModal` opens with a search input; selecting a note creates a `NoteCardNode` showing the note title and content preview

#### Scenario: Note card opens note

- **WHEN** the user double-clicks a `NoteCardNode`
- **THEN** the referenced note opens in the main editor (new tab if tab bar is active)

#### Scenario: Add image node

- **WHEN** the user clicks "Image" in the canvas toolbar
- **THEN** a file picker opens; selecting an image uploads it via `POST /api/v1/upload` and creates an `ImageNode` at the cursor position

#### Scenario: Add web preview node

- **WHEN** the user clicks "Link" in the canvas toolbar
- **THEN** an `AddLinkModal` opens with a URL input; submitting fetches OG preview and creates a `WebPreviewNode` showing title, description, and og:image

#### Scenario: Add group node

- **WHEN** the user clicks "Group" in the canvas toolbar
- **THEN** a `GroupNode` is created at the cursor with a default label of "Group"; double-click edits the label inline

### Requirement: Edges between nodes

The canvas editor SHALL allow users to draw directional edges between any two nodes. Each edge SHALL support an optional text label and an optional color. Arrow direction SHALL default to target-end only (matching JSON Canvas spec default).

#### Scenario: Draw edge

- **WHEN** the user hovers a node until connection handles appear, then drags from a handle to another node
- **THEN** a new edge is created between the two nodes and the canvas data is updated

#### Scenario: Label an edge

- **WHEN** the user double-clicks an edge
- **THEN** an inline text input appears on the edge midpoint; the user can type a label which is persisted

#### Scenario: Delete edge

- **WHEN** the user selects an edge and presses the Delete or Backspace key
- **THEN** the edge is removed from the canvas

### Requirement: Auto-save

The canvas editor SHALL automatically save canvas data to the server with a 1500ms debounce after any node or edge change. A save indicator SHALL be visible in the toolbar showing "Saved" or "Saving…" state.

#### Scenario: Node moved triggers save

- **WHEN** the user finishes dragging a node
- **THEN** a debounced save is triggered; after 1500ms of inactivity the system sends `PATCH /api/v1/canvases/:id`

#### Scenario: Save indicator

- **WHEN** a save is pending or in-flight
- **THEN** the toolbar shows "Saving…"
- **WHEN** the save completes successfully
- **THEN** the toolbar shows "Saved"

### Requirement: Canvas list page

The system SHALL provide a `/canvases` route that lists all canvases for the current vault as cards showing title, icon, and last-updated date. A "New Canvas" button SHALL create a canvas and immediately navigate to its editor.

#### Scenario: Create and navigate to new canvas

- **WHEN** the user clicks "New Canvas" on the canvases list page
- **THEN** the system calls `POST /api/v1/canvases`, then navigates to `/canvas/:newId`

#### Scenario: Open existing canvas

- **WHEN** the user clicks a canvas card on the list page
- **THEN** the user is navigated to `/canvas/:id`

#### Scenario: Delete canvas from list

- **WHEN** the user opens the context menu on a canvas card and selects "Delete"
- **THEN** a confirmation modal appears; confirming sends `DELETE /api/v1/canvases/:id` and removes the card

### Requirement: Sidebar Canvases navigation

The sidebar SHALL include a "Canvases" navigation link below (or alongside) the existing Graph, Quick Notes, and Tags links. Clicking it SHALL navigate to `/canvases`.

#### Scenario: Navigate to canvases

- **WHEN** the user clicks the "Canvases" nav link in the sidebar
- **THEN** the router navigates to `/canvases` and the canvases list is displayed

### Requirement: Canvas list live thumbnail

Each canvas card on the `/canvases` list page SHALL render a live, non-interactive thumbnail of the canvas contents using a scaled-down React Flow instance. The thumbnail SHALL mount lazily (only when the card is scrolled into view) and be non-interactive (`pointer-events: none`).

#### Scenario: Thumbnail shows canvas nodes

- **WHEN** a canvas card is visible in the list and the canvas `data` contains nodes
- **THEN** a miniature React Flow render of those nodes is displayed inside the card, matching their relative positions

#### Scenario: Thumbnail for empty canvas

- **WHEN** a canvas card's `data` has no nodes
- **THEN** the thumbnail area shows a subtle placeholder (e.g., a grid pattern or "Empty canvas" text)

#### Scenario: Thumbnail mounts lazily

- **WHEN** a canvas card is outside the visible viewport
- **THEN** the React Flow instance is not mounted; it mounts only when the card scrolls into view

### Requirement: Canvas title search

The system SHALL support searching canvases by title. The `GET /api/v1/canvases` endpoint SHALL accept an optional `?q=` query parameter and return only canvases whose title contains the query string (case-insensitive). The sidebar search bar SHALL include canvas results alongside note results, distinguished by a canvas icon.

#### Scenario: Search finds matching canvas

- **WHEN** the user types in the sidebar search bar
- **THEN** the system queries both notes and canvases in parallel; canvases whose titles match are shown in the results list with a canvas icon

#### Scenario: Search with no canvas matches

- **WHEN** the query matches no canvas titles
- **THEN** no canvas results are shown; note results are unaffected

#### Scenario: API search parameter

- **WHEN** a client sends `GET /api/v1/canvases?q=research`
- **THEN** only canvases with "research" (case-insensitive) in their title are returned

### Requirement: Deleted-note placeholder in NoteCardNode

When a `NoteCardNode`'s referenced note cannot be found (note was deleted or is inaccessible), the card SHALL display a visible "Note deleted" placeholder state rather than a blank or errored card.

#### Scenario: Note exists

- **WHEN** the `NoteCardNode`'s `file` field resolves to an existing, accessible note
- **THEN** the card displays the note title and content preview normally

#### Scenario: Note deleted

- **WHEN** the `NoteCardNode`'s `file` field references a note ID not present in the notes list (or the note API returns 404)
- **THEN** the card renders with a muted/grey appearance, a strikethrough title showing the raw note ID, and the text "Note deleted" as a subtitle; double-click is disabled
