/**
 * Resolves the API / WebSocket server base URLs for the current runtime.
 *
 * Resolution order:
 *  1. `window.nodeiraNative` — injected by the native Android shell (WebView). The
 *     web bundle is served from a local virtual origin, so REST + WS must be pointed
 *     at the user's server explicitly. A dedicated bridge (rather than reusing
 *     `window.electronAPI`) keeps the web app on browser history + the normal
 *     setup/login flow inside the WebView.
 *  2. `window.electronAPI` — injected by the Electron desktop preload.
 *  3. Same-origin — the plain browser PWA (Vite proxies /api and /sync).
 */

import "./electronAPI.js";

export {};

declare global {
  interface Window {
    nodeiraNative?: {
      /** Full server base URL, e.g. "https://notes.example.com" */
      apiBaseUrl: string;
      /** WebSocket server base URL, e.g. "wss://notes.example.com" */
      wsBaseUrl: string;
    };
  }
}

/** Base URL for REST requests; empty string means same-origin. */
export function getApiBaseUrl(): string {
  return window.nodeiraNative?.apiBaseUrl ?? window.electronAPI?.apiBaseUrl ?? "";
}

/** Full WebSocket sync URL including the trailing `/sync` path. */
export function getSyncWsUrl(): string {
  if (window.nodeiraNative?.wsBaseUrl) return `${window.nodeiraNative.wsBaseUrl}/sync`;
  if (window.electronAPI?.wsBaseUrl) return `${window.electronAPI.wsBaseUrl}/sync`;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return import.meta.env["VITE_SYNC_WS_URL"] ?? `${proto}://${window.location.host}/sync`;
}
