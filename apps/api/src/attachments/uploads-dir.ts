import { join } from "path";

/**
 * On-disk home for uploaded images and PDFs.
 *
 * Resolved per call rather than captured at module load: the API tests boot the app from a
 * different cwd than `pnpm --filter @nodeira/api dev`, and a frozen constant would send the
 * upload route and the fetch route to two different directories.
 */
export function uploadsDir(): string {
  return join(process.cwd(), "uploads");
}

/**
 * The only filenames the fetch route will serve.
 *
 * Uploads are named `${randomUUID()}${ext}` and nothing else ever lands in the directory, so
 * this is an allowlist rather than a sanitiser — it makes `..%2f`, absolute paths, dotfiles
 * and nested segments unrepresentable instead of trying to strip them.
 */
export const ATTACHMENT_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|gif|webp|pdf)$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** Content-Type for an allowlisted attachment filename. */
export function contentTypeFor(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
