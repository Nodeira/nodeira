import { useSyncExternalStore } from "react";
import { authStorage } from "./authStorage.js";
import { getApiBaseUrl } from "./serverConfig.js";

/**
 * Resolving stored attachment paths to fetchable, authenticated URLs.
 *
 * Uploads are stored inside note documents as `/uploads/<uuid>.<ext>` — a server-relative
 * string that predates every client but the browser one, and that two of the three clients
 * cannot resolve at all: the desktop app runs from `file://` and the Android WebView from
 * `https://appassets.androidplatform.net`, so a bare `/uploads/...` in an `<img>` pointed at
 * the wrong origin and rendered broken on both.
 *
 * Rather than rewrite the embeds — a Yjs migration across every existing note — the stored
 * form stays exactly as it is and resolution happens at render time. That fixes the origin
 * problem and gives the credential somewhere to live in one move.
 *
 * The credential is a ticket, not the session JWT: it expires within the hour and unlocks
 * only the attachment route, which is the right thing to be putting in a query string. One
 * ticket covers every attachment for the session, which keeps `attachmentUrl` synchronous —
 * `<img src>` and react-pdf's `file` prop both need a URL now, not a promise.
 */

const UPLOAD_PREFIX = "/uploads/";

/** Refresh this far ahead of expiry, so a load never races the rotation. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface Ticket {
  ticket: string;
  expiresAt: number;
}

let current: Ticket | null = null;
let inFlight: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Snapshot for `useSyncExternalStore`, which compares by identity and re-renders forever if
 * the value churns. Returning the ticket string (not an object, and with no `Date.now()` in
 * the comparison) keeps it stable between rotations.
 */
function getTicket(): string | null {
  return current?.ticket ?? null;
}

async function fetchTicket(): Promise<void> {
  const token = authStorage.getToken();
  if (!token) return;

  const res = await fetch(`${getApiBaseUrl()}/api/v1/attachments/ticket`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;

  current = (await res.json()) as Ticket;
  scheduleRefresh();
  emit();
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!current) return;
  const delay = Math.max(60_000, current.expiresAt - Date.now() - REFRESH_MARGIN_MS);
  refreshTimer = setTimeout(() => {
    current = null;
    void ensureTicket();
  }, delay);
}

/** Fetches a ticket if there isn't a live one. Safe to call from anywhere, repeatedly. */
export function ensureTicket(): Promise<void> {
  if (current && current.expiresAt - REFRESH_MARGIN_MS > Date.now()) return Promise.resolve();
  inFlight ??= fetchTicket().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Drops the cached ticket. Call on logout so the next user does not inherit it. */
export function clearAttachmentTicket(): void {
  current = null;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  emit();
}

/** True for the stored form of an upload, as opposed to an external or data URL. */
export function isAttachmentPath(src: string): boolean {
  return src.startsWith(UPLOAD_PREFIX);
}

/**
 * Maps a stored attachment path to a fetchable URL, or returns non-attachment sources
 * (external images, data URLs) untouched. Returns undefined while the ticket is still on its
 * way — callers render a placeholder for that frame.
 */
export function attachmentUrl(src: string, ticket: string | null): string | undefined {
  if (!isAttachmentPath(src)) return src;
  if (!ticket) return undefined;
  const filename = src.slice(UPLOAD_PREFIX.length);
  return `${getApiBaseUrl()}/api/v1/attachments/${filename}?t=${encodeURIComponent(ticket)}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void ensureTicket();
  return () => listeners.delete(listener);
}

/**
 * Resolves an attachment source for rendering, re-rendering when the ticket arrives or
 * rotates. Undefined means "not loadable yet"; anything else is ready to hand to an `<img>`.
 */
export function useAttachmentUrl(src: string | null | undefined): string | undefined {
  const ticket = useSyncExternalStore(subscribe, getTicket, () => null);
  if (!src) return undefined;
  return attachmentUrl(src, ticket);
}
