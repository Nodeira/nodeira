/**
 * Type declarations for window.electronAPI injected by apps/desktop/src/preload.ts.
 * Only present when running inside the Electron desktop app.
 */

import type { NoteMetadata } from "@nodeira/shared-types";

/** Global-shortcut actions the user can rebind from Settings. */
export type KeybindAction = "newNote" | "newQuickNote";

/** Map of action → Electron accelerator string (e.g. "CommandOrControl+Shift+N"). */
export type Keybinds = Record<KeybindAction, string>;

declare global {
  interface Window {
    electronAPI?: {
      /** Full server base URL, empty string when not yet configured */
      apiBaseUrl: string;
      /** WebSocket server base URL, empty string when not yet configured */
      wsBaseUrl: string;
      /** Packaged app version (e.g. "1.19.0") */
      appVersion: string;

      settings: {
        /** Save the server URL to persistent storage and reload the window */
        setServerUrl(url: string): Promise<void>;
        /** Current global-shortcut bindings (read synchronously at preload time). */
        getKeybinds(): Keybinds;
        /**
         * Persist new bindings and re-register the OS global shortcuts.
         * Returns which actions registered successfully — a `false` means the
         * accelerator was rejected (e.g. already claimed by another app).
         */
        setKeybinds(keybinds: Keybinds): Promise<Record<KeybindAction, boolean>>;
      };

      sqlite: {
        loadYjsState(noteId: string): Promise<Uint8Array | null>;
        saveYjsState(noteId: string, state: Uint8Array): Promise<void>;
        /**
         * Dates arrive as ISO strings — JSON (the IPC wire format) cannot carry
         * Date objects. Callers must rehydrate via `new Date(...)` before use.
         */
        getNoteMetadata(): Promise<
          Array<
            Omit<NoteMetadata, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string }
          >
        >;
        upsertNoteMetadata(notes: NoteMetadata[]): Promise<void>;
      };

      plugin: {
        getCachedBundle(source: string): Promise<string | null>;
        setCachedBundle(source: string, bundle: string): Promise<void>;
      };

      /** Show a native OS notification (desktop only). */
      showNotification?(payload: { title: string; body?: string }): Promise<void>;

      /** Check for updates, download them, and install them (Windows/macOS only). */
      update: {
        /** Silently peek at the update feed; fires onAvailable/onNotAvailable/onError. */
        check(): Promise<void>;
        /** Start downloading a previously-announced update; fires onDownloaded/onError. */
        download(): Promise<void>;
        /** Quit and install the downloaded update, relaunching the app on the new version. */
        install(): Promise<void>;
        /** Subscribe to "a newer version was found" events. Returns an unsubscribe function. */
        onAvailable(callback: (info: { version: string; notes: string }) => void): () => void;
        /** Subscribe to "already up to date" events. Returns an unsubscribe function. */
        onNotAvailable(callback: () => void): () => void;
        /** Subscribe to "update finished downloading" events. Returns an unsubscribe function. */
        onDownloaded(callback: () => void): () => void;
        /** Subscribe to update-check/download errors. Returns an unsubscribe function. */
        onError(callback: (message: string) => void): () => void;
      };

      /** Subscribe to "create new note" events from the main process menu/global shortcut. Returns an unsubscribe function. */
      onNewNote(callback: () => void): () => void;
      /** Subscribe to "create new quick note" events from the global shortcut. Returns an unsubscribe function. */
      onNewQuickNote(callback: () => void): () => void;
      /** Subscribe to "open search" events from the main process menu. Returns an unsubscribe function. */
      /** Subscribe to "toggle sidebar" events from the main process menu. Returns an unsubscribe function. */
      onToggleSidebar(callback: () => void): () => void;
    };
  }
}
