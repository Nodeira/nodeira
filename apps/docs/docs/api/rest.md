---
id: rest
sidebar_position: 1
---

# REST API

The NestJS server exposes a JSON REST API at `http://localhost:3001/api` (proxied from Vite dev server at `/api`).

---

## Vaults

### `GET /api/vaults`

Returns all vaults.

**Response**

```json
[{ "id": "clv...", "name": "Personal", "createdAt": "...", "updatedAt": "..." }]
```

### `POST /api/vaults`

Creates a new vault.

**Body**

```json
{ "name": "Work" }
```

### `DELETE /api/vaults/:id`

Deletes a vault and all its contents.

---

## Folders

### `GET /api/folders?vaultId=<id>`

Returns all folders in a vault.

### `POST /api/folders`

Creates a folder.

**Body**

```json
{ "name": "Projects", "vaultId": "clv..." }
```

### `PATCH /api/folders/:id`

Updates a folder's icon.

**Body**

```json
{ "icon": "📁" }
```

Pass `null` to clear the icon.

### `DELETE /api/folders/:id`

Deletes the folder (notes are not deleted).

---

## Notes

### `GET /api/notes?vaultId=<id>`

Returns all notes in a vault, ordered by the `order` field.

### `GET /api/notes/:id`

Returns a single note (metadata only; document content is delivered via the Yjs WebSocket).

### `POST /api/notes`

Creates a note.

**Body**

```json
{
  "title": "My note",
  "vaultId": "clv...",
  "folderId": "clf..."
}
```

`vaultId` and `folderId` are optional.

### `PATCH /api/notes/reorder`

Bulk-updates note ordering. Must be called **before** `PATCH /api/notes/:id` to avoid the route conflict.

**Body**

```json
{
  "items": [
    { "id": "cln...", "order": 0 },
    { "id": "clm...", "order": 1 }
  ]
}
```

### `PATCH /api/notes/:id`

Updates a note's metadata (title, folderId, etc.).

### `DELETE /api/notes/:id`

Deletes a note.

---

## Upload

### `POST /api/upload`

Uploads an image file.

**Request** — `multipart/form-data`, field name `file`.

**Constraints** — images only, max 10 MB.

**Response**

```json
{ "url": "/uploads/<uuid>.<ext>" }
```

---

## Sync (WebSocket)

Note content is **not** exchanged over REST. It flows through the Yjs WebSocket gateway:

```
ws://localhost:3001/sync/<noteId>
```

In development this is proxied from `ws://localhost:5173/sync/<noteId>` by Vite. See [Real-time Sync](../architecture/sync) for details.
