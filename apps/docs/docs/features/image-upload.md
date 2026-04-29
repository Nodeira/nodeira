---
id: image-upload
sidebar_position: 4
---

# Image Upload

Nodeira supports uploading images into notes. Uploaded files are stored on the server's local filesystem and served as static assets.

## Constraints

| Property         | Value                             |
| ---------------- | --------------------------------- |
| Max file size    | 10 MB                             |
| Accepted types   | Images only (`image/*` MIME type) |
| Storage location | `apps/server/uploads/`            |

## Inserting an image

Use the editor toolbar's image button or paste an image from your clipboard. The file is uploaded automatically and inserted into the note at the cursor position.

:::note
Image storage is currently local filesystem only. A future release will add object storage (e.g. S3-compatible) support.
:::
