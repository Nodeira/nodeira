## ADDED Requirements

### Requirement: CanvasEmbed TipTap extension

The system SHALL provide a `CanvasEmbed` custom TipTap node extension that can be inserted into a note. The node SHALL store a `canvasId` attribute pointing to an existing canvas. The extension SHALL be registered in `NoteEditor.tsx` alongside other custom extensions (`PdfEmbed`, `WikiLink`, etc.).

#### Scenario: Insert canvas embed via toolbar

- **WHEN** the user clicks a "Embed Canvas" action in the note toolbar (or types a slash command)
- **THEN** a modal opens showing the list of canvases; selecting one inserts a `CanvasEmbed` block with the chosen `canvasId`

#### Scenario: Serialize canvas embed in note

- **WHEN** a note containing a `CanvasEmbed` node is stored as a Yjs document
- **THEN** the `canvasId` attribute is preserved in the ProseMirror document and survives round-trips through the Yjs state

### Requirement: CanvasEmbed renders read-only miniature canvas

The `CanvasEmbed` component SHALL render a bounded, read-only version of the referenced canvas using React Flow. The miniature SHALL support panning (drag) but not editing, node creation, or edge creation. The miniature height SHALL default to 300px and be configurable via a resize handle.

#### Scenario: Render canvas miniature

- **WHEN** a note containing a `CanvasEmbed` block is viewed
- **THEN** the block renders the canvas nodes and edges in a read-only React Flow instance sized to the embed's bounding box

#### Scenario: Canvas not found

- **WHEN** the `canvasId` references a canvas that has been deleted or is inaccessible
- **THEN** the embed shows a placeholder card with the text "Canvas not found"

#### Scenario: Open full canvas on double-click

- **WHEN** the user double-clicks the canvas embed miniature
- **THEN** the router navigates to `/canvas/:canvasId` to open the full canvas editor
