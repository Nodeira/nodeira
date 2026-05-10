"use strict";
const electron = require("electron");
const SERVER_URL = electron.ipcRenderer.sendSync("settings:getServerUrl") ?? "";
const WS_URL = SERVER_URL.replace(/^http/, "ws");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  /** Base URL for REST API calls — used by apps/web api.ts instead of relative /api/... */
  apiBaseUrl: SERVER_URL,
  /** Base URL for WebSocket sync — used by YjsProvider instead of window.location.host */
  wsBaseUrl: WS_URL,
  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    setServerUrl(url) {
      return electron.ipcRenderer.invoke("settings:setServerUrl", url);
    }
  },
  // ── SQLite: Yjs state ─────────────────────────────────────────────────────
  sqlite: {
    loadYjsState(noteId) {
      return electron.ipcRenderer.invoke("sqlite:loadYjsState", noteId);
    },
    saveYjsState(noteId, state) {
      return electron.ipcRenderer.invoke("sqlite:saveYjsState", noteId, state);
    },
    getNoteMetadata() {
      return electron.ipcRenderer.invoke("sqlite:getNoteMetadata");
    },
    upsertNoteMetadata(notes) {
      return electron.ipcRenderer.invoke("sqlite:upsertNoteMetadata", notes);
    }
  },
  // ── Plugin cache ──────────────────────────────────────────────────────────
  plugin: {
    getCachedBundle(source) {
      return electron.ipcRenderer.invoke("plugin:getCachedBundle", source);
    },
    setCachedBundle(source, bundle) {
      return electron.ipcRenderer.invoke("plugin:setCachedBundle", source, bundle);
    }
  },
  // ── Renderer ← Main events ────────────────────────────────────────────────
  /** Listen for "create new note" triggered by menu/global shortcut */
  onNewNote(callback) {
    const listener = () => callback();
    electron.ipcRenderer.on("new-note", listener);
    return () => {
      electron.ipcRenderer.removeListener("new-note", listener);
    };
  },
  /** Listen for "open search" triggered by menu */
  onOpenSearch(callback) {
    const listener = () => callback();
    electron.ipcRenderer.on("open-search", listener);
    return () => {
      electron.ipcRenderer.removeListener("open-search", listener);
    };
  },
  /** Listen for "toggle sidebar" triggered by menu */
  onToggleSidebar(callback) {
    const listener = () => callback();
    electron.ipcRenderer.on("toggle-sidebar", listener);
    return () => {
      electron.ipcRenderer.removeListener("toggle-sidebar", listener);
    };
  }
});
