---
id: rest
sidebar_position: 1
---

# REST API

The NestJS server exposes a JSON REST API at `http://localhost:3001/api` (proxied from the Vite dev server at `/api`).

All endpoints except `/api/setup/*` and `/api/auth/login` require a JWT bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Authentication

### `GET /api/setup/status`

Returns whether first-time setup is still required.

**Response**

```json
{ "setupRequired": true }
```

Once an admin account exists this returns `{ "setupRequired": false }` and `POST /api/setup` is locked.

---

### `POST /api/setup`

Creates the initial admin account. **Only works when no users exist.** Subsequent calls return `403 Forbidden`.

**Body**

```json
{
  "email": "admin@example.com",
  "password": "strongpassword",
  "name": "Alice"
}
```

`name` is optional. `password` must be at least 8 characters.

**Response**

```json
{
  "access_token": "<jwt>",
  "user": { "id": "...", "email": "admin@example.com", "name": "Alice", "role": "ADMIN" }
}
```

---

### `POST /api/auth/login`

Authenticates an existing user and returns a JWT.

**Body**

```json
{
  "email": "admin@example.com",
  "password": "strongpassword",
  "rememberMe": false
}
```

`rememberMe` is optional. When `true` the token expires in 30 days; otherwise it expires in 60 minutes.

**Response**

```json
{
  "access_token": "<jwt>",
  "user": { "id": "...", "email": "admin@example.com", "name": "Alice", "role": "ADMIN" }
}
```

Store `access_token` and attach it to subsequent requests as `Authorization: Bearer <token>`.

---

### `GET /api/auth/profile`

Returns the currently authenticated user.

**Response**

```json
{ "id": "...", "email": "admin@example.com", "name": "Alice", "role": "ADMIN" }
```

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

## Canvases

### `GET /api/canvases?vaultId=<id>&q=<search>`

Returns all canvases, ordered by `position` then `createdAt`. Both query params are optional.

**Response**

```json
[
  {
    "id": "clc...",
    "title": "Architecture diagram",
    "vaultId": "clv...",
    "folderId": null,
    "data": { "nodes": [], "edges": [] },
    "pinned": false,
    "icon": "🗺️",
    "position": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### `POST /api/canvases`

Creates a new canvas.

**Body**

```json
{ "title": "My diagram", "vaultId": "clv...", "folderId": "clf..." }
```

All fields are optional. `title` defaults to `"Untitled Canvas"`. Position is auto-assigned.

### `GET /api/canvases/:id`

Returns a single canvas including full `data` (nodes + edges).

### `PATCH /api/canvases/:id`

Updates canvas metadata or data.

**Body** (all fields optional)

```json
{
  "title": "Renamed",
  "data": { "nodes": [...], "edges": [...] },
  "pinned": true,
  "icon": "🗺️",
  "position": 2
}
```

### `DELETE /api/canvases/:id`

Deletes the canvas. Returns `204 No Content`.

### `POST /api/canvases/preview`

Fetches Open Graph metadata for a URL (used for Link nodes).

**Body**

```json
{ "url": "https://example.com" }
```

**Response**

```json
{
  "title": "Example Domain",
  "description": "...",
  "image": "https://example.com/og.png",
  "favicon": "https://example.com/favicon.ico",
  "url": "https://example.com"
}
```

Returns `422 Unprocessable Entity` if the URL cannot be fetched.

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
