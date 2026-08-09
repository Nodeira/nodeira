/**
 * Which note or canvas the current route is showing.
 *
 * The `/^\/notes\/([^/]+)$/` literal was written out in `AppShell`, `TabBar` and `BrowsePane`.
 * Three copies of a route shape is three places to miss when the route changes — and TanStack
 * Router already owns that shape, so hand-parsing it anywhere is a liability. Keeping the
 * parsing in one module at least makes the liability singular.
 */

const NOTE_ROUTE = /^\/notes\/([^/]+)$/;
const CANVAS_ROUTE = /^\/canvas\/([^/]+)$/;

/** The note id the given pathname displays, or null. */
export function noteIdFromPath(pathname: string): string | null {
  return pathname.match(NOTE_ROUTE)?.[1] ?? null;
}

/** The canvas id the given pathname displays, or null. */
export function canvasIdFromPath(pathname: string): string | null {
  return pathname.match(CANVAS_ROUTE)?.[1] ?? null;
}
