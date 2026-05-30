---
id: canvas
sidebar_position: 5
---

# Canvas

The Canvas view is a freeform, infinite whiteboard for brainstorming, diagramming, and linking notes together visually.

## Creating a canvas

1. Click **Canvases** in the sidebar.
2. Click **New Canvas**. The canvas is created immediately with the title "Untitled Canvas".
3. Click the title to rename it.

## Node types

| Type | Description |
|------|-------------|
| **Text** | A plain-text sticky note |
| **Note** | Embeds an existing note from your vault (read-only preview) |
| **Link** | A web URL with an Open Graph preview card (title, description, favicon) |
| **Image** | An uploaded image |
| **Group** | A labelled bounding box for organising other nodes |

### Adding nodes

Click the **+** button in the canvas toolbar and choose a node type. For Link nodes, paste the URL and click **Fetch** to load the preview.

## Edges (connections)

Click and drag from any node handle (the small dot on each side) to another node to create a directed edge. Edges support:

- Arrow direction (one-way or none)
- Line style: straight, bezier, smoothstep, step
- Custom colour and label (edit via right-click context menu)

## Embedding canvases in notes

Inside the note editor, type `/canvas` to open the canvas picker. The selected canvas is embedded as a live, read-only miniature inside the note body.

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Pan | Middle-click drag, or Space + drag |
| Zoom | Scroll wheel |
| Select all | Ctrl/⌘ + A |
| Delete selected | Backspace / Delete |
| Undo | Ctrl/⌘ + Z |
| Redo | Ctrl/⌘ + Shift + Z |
