---
id: image-upload
sidebar_position: 4
---

# Attachments

Nodeira supports uploading images and PDFs into notes. Uploaded files are stored on the server's
local filesystem and served through an authenticated route.

## Constraints

| Property         | Value                                          |
| ---------------- | ---------------------------------------------- |
| Max file size    | 50 MB                                          |
| Accepted types   | PNG, JPEG, GIF, WebP, PDF                      |
| Storage location | `apps/api/uploads/`                            |
| Filename         | `<uuid>.<ext>` — the original name is not kept |

The type is determined by reading the file's magic bytes, not by trusting the `Content-Type`
header or the extension the browser reports. A file whose contents do not match one of the
accepted formats is rejected.

## Inserting an attachment

Use the editor toolbar's image or PDF button, or paste an image from your clipboard. The file
uploads automatically and is inserted into the note at the cursor position.

## How attachments are fetched

`POST /api/v1/upload` returns `{ "url": "/uploads/<uuid>.<ext>" }`, and that string is what gets
stored in the note. It is **not** a URL you can request directly — nothing is served under
`/uploads`. Clients resolve it at render time to:

```
GET /api/v1/attachments/<uuid>.<ext>
```

which requires credentials. Two forms are accepted:

- **`Authorization: Bearer <token>`** — a session JWT or an `ndra_` API token. This is the path
  for scripts, the CLI, and anything that can set headers.
- **`?t=<ticket>`** — a short-lived ticket from `GET /api/v1/attachments/ticket`. Browsers cannot
  attach a header to an `<img>` or a PDF fetch, so the web, desktop and Android clients request
  one ticket per session and append it to every attachment URL. A ticket expires within the hour
  and opens no other route.

Any authenticated user of the instance can fetch any attachment by name. Attachments are not
scoped to the vault of the note that embeds them.

:::note
Attachment storage is currently local filesystem only. A future release will add object storage
(e.g. S3-compatible) support.
:::

:::warning
Before 1.16.0, `/uploads` was served as a static directory with no authentication at all — every
uploaded image and PDF was fetchable by anyone who could reach the server, with the random
filename as the only barrier. If your instance was ever exposed to a network you do not control,
treat previously uploaded files as public.
:::
