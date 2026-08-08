import { contextBridge, ipcRenderer } from "electron";

const SERVER_URL = (ipcRenderer.sendSync("settings:getServerUrl") as string) ?? "";
const WS_URL = SERVER_URL.replace(/^http/, "ws");

contextBridge.exposeInMainWorld("electronAPI", {
  /** Base URL for REST API calls — used by apps/web api.ts instead of relative /api/... */
  apiBaseUrl: SERVER_URL,

  /** Base URL for WebSocket sync — used by YjsProvider instead of window.location.host */
  wsBaseUrl: WS_URL,

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    setServerUrl(url: string): Promise<void> {
      return ipcRenderer.invoke("settings:setServerUrl", url) as Promise<void>;
    },
    getKeybinds(): Record<string, string> {
      return ipcRenderer.sendSync("settings:getKeybinds") as Record<string, string>;
    },
    setKeybinds(keybinds: Record<string, string>): Promise<Record<string, boolean>> {
      return ipcRenderer.invoke("settings:setKeybinds", keybinds) as Promise<
        Record<string, boolean>
      >;
    },
  },

  // ── SQLite: Yjs state ─────────────────────────────────────────────────────
  sqlite: {
    loadYjsState(noteId: string): Promise<Uint8Array | null> {
      return ipcRenderer.invoke("sqlite:loadYjsState", noteId) as Promise<Uint8Array | null>;
    },
    saveYjsState(noteId: string, state: Uint8Array): Promise<void> {
      return ipcRenderer.invoke("sqlite:saveYjsState", noteId, state) as Promise<void>;
    },
    getNoteMetadata(): Promise<unknown[]> {
      return ipcRenderer.invoke("sqlite:getNoteMetadata") as Promise<unknown[]>;
    },
    upsertNoteMetadata(notes: unknown[]): Promise<void> {
      return ipcRenderer.invoke("sqlite:upsertNoteMetadata", notes) as Promise<void>;
    },
  },

  // ── Plugin cache ──────────────────────────────────────────────────────────
  plugin: {
    getCachedBundle(source: string): Promise<string | null> {
      return ipcRenderer.invoke("plugin:getCachedBundle", source) as Promise<string | null>;
    },
    setCachedBundle(source: string, bundle: string): Promise<void> {
      return ipcRenderer.invoke("plugin:setCachedBundle", source, bundle) as Promise<void>;
    },
  },

  // ── Native notifications ───────────────────────────────────────────────────
  /** Show a native OS notification for a fired reminder (works from the tray). */
  showNotification(payload: { title: string; body?: string }): Promise<void> {
    return ipcRenderer.invoke("notification:show", payload) as Promise<void>;
  },

  // ── Renderer ← Main events ────────────────────────────────────────────────
  /** Listen for "create new note" triggered by menu/global shortcut */
  onNewNote(callback: () => void): () => void {
    const listener = () => callback();
    ipcRenderer.on("new-note", listener);
    return () => {
      ipcRenderer.removeListener("new-note", listener);
    };
  },

  /** Listen for "create new quick note" triggered by the global shortcut */
  onNewQuickNote(callback: () => void): () => void {
    const listener = () => callback();
    ipcRenderer.on("new-quick-note", listener);
    return () => {
      ipcRenderer.removeListener("new-quick-note", listener);
    };
  },

  /** Listen for "toggle sidebar" triggered by menu */
  onToggleSidebar(callback: () => void): () => void {
    const listener = () => callback();
    ipcRenderer.on("toggle-sidebar", listener);
    return () => {
      ipcRenderer.removeListener("toggle-sidebar", listener);
    };
  },
});
