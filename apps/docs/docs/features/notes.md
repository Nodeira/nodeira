---
id: notes
sidebar_position: 3
---

# Notes

Notes are the primary content unit in Nodeira. Each note has a title, optional rich-text body, and an optional parent folder.

## Editor

Notes are edited with [TipTap](https://tiptap.dev), a ProseMirror-based rich-text editor. The editor's document is backed by a `Y.Doc` (Yjs CRDT), which means:

- Changes are persisted locally to IndexedDB immediately.
- Changes sync to the server via WebSocket when online.
- Multiple tabs editing the same note see updates in real time.

See [Real-time Sync](../architecture/sync) for the full technical picture.

## Operations

| Action | Description |
|---|---|
| Create | Give it a title; optionally place it inside a vault or folder |
| Edit | Click a note in the sidebar to open it in the editor |
| Rename | Double-click the note title in the sidebar |
| Reorder | Drag notes in the sidebar to change their position |
| Delete | Right-click the note in the sidebar and choose Delete |

## Quick Notes

The **Quick Notes** view surfaces a scratch-pad note that doesn't belong to any vault or folder — handy for jotting things down before organising them.
