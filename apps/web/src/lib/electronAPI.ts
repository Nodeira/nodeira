/**
 * Type declarations for window.electronAPI injected by apps/desktop/src/preload.ts.
 * Only present when running inside the Electron desktop app.
 */

import type { NoteMetadata } from "@nodeira/shared-types";

export {};

declare global {
  interface Window {
    electronAPI?: {
      /** Full server base URL, empty string when not yet configured */
      apiBaseUrl: string;
      /** WebSocket server base URL, empty string when not yet configured */
      wsBaseUrl: string;

      settings: {
        /** Save the server URL to persistent storage and reload the window */
        setServerUrl(url: string): Promise<void>;
      };

      sqlite: {
        loadYjsState(noteId: string): Promise<Uint8Array | null>;
        saveYjsState(noteId: string, state: Uint8Array): Promise<void>;
        getNoteMetadata(): Promise<NoteMetadata[]>;
        upsertNoteMetadata(notes: NoteMetadata[]): Promise<void>;
      };

      plugin: {
        getCachedBundle(source: string): Promise<string | null>;
        setCachedBundle(source: string, bundle: string): Promise<void>;
      };

      /** Show a native OS notification (desktop only). */
      showNotification?(payload: { title: string; body?: string }): Promise<void>;

      /** Subscribe to "create new note" events from the main process menu/global shortcut. Returns an unsubscribe function. */
      onNewNote(callback: () => void): () => void;
      /** Subscribe to "open search" events from the main process menu. Returns an unsubscribe function. */
      onOpenSearch(callback: () => void): () => void;
      /** Subscribe to "toggle sidebar" events from the main process menu. Returns an unsubscribe function. */
      onToggleSidebar(callback: () => void): () => void;
    };
  }
}
