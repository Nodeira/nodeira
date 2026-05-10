"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
let db = null;
function openDatabase(userDataPath) {
  db = new Database(path.join(userDataPath, "nodeira.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS yjs_state (
      note_id TEXT PRIMARY KEY,
      state    BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_metadata (
      note_id    TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      type       TEXT NOT NULL DEFAULT 'note',
      kind       TEXT,
      kind_meta  TEXT,
      vault_id   TEXT,
      folder_id  TEXT,
      pinned     INTEGER NOT NULL DEFAULT 0,
      icon       TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plugin_cache (
      plugin_id TEXT PRIMARY KEY,
      source    TEXT NOT NULL,
      bundle    TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
function loadYjsState(noteId) {
  if (!db) return null;
  const row = db.prepare("SELECT state FROM yjs_state WHERE note_id = ?").get(noteId);
  return row ? new Uint8Array(row.state) : null;
}
function saveYjsState(noteId, state) {
  if (!db) return;
  db.prepare("INSERT OR REPLACE INTO yjs_state (note_id, state, updated_at) VALUES (?, ?, ?)").run(
    noteId,
    Buffer.from(state),
    Date.now()
  );
}
function loadNoteMetadata() {
  if (!db) return [];
  const rows = db.prepare("SELECT * FROM note_metadata ORDER BY position").all();
  return rows.map(rowToMetadata);
}
function upsertNoteMetadata(notes) {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO note_metadata
      (note_id, title, type, kind, kind_meta, vault_id, folder_id, pinned, icon, created_at, updated_at, position)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((items) => {
    for (const n of items) {
      stmt.run(
        n.id,
        n.title,
        n.type,
        n.kind ?? null,
        n.kindMeta ? JSON.stringify(n.kindMeta) : null,
        n.vaultId ?? null,
        n.folderId ?? null,
        n.pinned ? 1 : 0,
        n.icon ?? null,
        n.createdAt.getTime(),
        n.updatedAt.getTime(),
        n.position
      );
    }
  });
  tx(notes);
}
function rowToMetadata(row) {
  return {
    id: row.note_id,
    title: row.title,
    type: row.type,
    kind: row.kind,
    kindMeta: row.kind_meta ? JSON.parse(row.kind_meta) : null,
    vaultId: row.vault_id,
    folderId: row.folder_id,
    pinned: row.pinned === 1,
    icon: row.icon,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    position: row.position
  };
}
function pluginIdFromSource(source) {
  const atIdx = source.lastIndexOf("@");
  const repoPath = atIdx > 0 ? source.slice(0, atIdx) : source;
  const slashIdx = repoPath.lastIndexOf("/");
  return slashIdx >= 0 ? repoPath.slice(slashIdx + 1) : repoPath;
}
function getCachedBundle(source) {
  if (!db) return null;
  const pluginId = pluginIdFromSource(source);
  const row = db.prepare("SELECT bundle FROM plugin_cache WHERE plugin_id = ?").get(pluginId);
  return (row == null ? void 0 : row.bundle) ?? null;
}
function setCachedBundle(source, bundle) {
  if (!db) return;
  const pluginId = pluginIdFromSource(source);
  db.prepare(
    "INSERT OR REPLACE INTO plugin_cache (plugin_id, source, bundle, cached_at) VALUES (?, ?, ?, ?)"
  ).run(pluginId, source, bundle, Date.now());
}
function getSetting(key) {
  if (!db) return null;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return (row == null ? void 0 : row.value) ?? null;
}
function setSetting(key, value) {
  if (!db) return;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
if (process.platform === "win32" && process.argv.some((a) => a.startsWith("--squirrel"))) {
  electron.app.quit();
  process.exit(0);
}
if (!electron.app.requestSingleInstanceLock()) {
  electron.app.quit();
  process.exit(0);
}
let mainWindow = null;
let tray = null;
let isQuitting = false;
const isDev = !electron.app.isPackaged;
let serverUrl = "";
let wsUrl = "";
function createWindow() {
  setupCSP();
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: "Nodeira",
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true
    }
  });
  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    const distPath = path.join(process.resourcesPath, "dist");
    void mainWindow.loadFile(path.join(distPath, "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault();
      mainWindow == null ? void 0 : mainWindow.hide();
    }
  });
}
function setupCSP() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          [
            "default-src 'self' file: http://localhost:* https://localhost:*",
            `script-src 'self' 'unsafe-eval' ${isDev ? "'unsafe-inline'" : ""} https://cdn.jsdelivr.net`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: file: http://localhost:*",
            "font-src 'self' data:",
            `connect-src 'self' file: http://localhost:* ws://localhost:* wss://localhost:* https://cdn.jsdelivr.net ${serverUrl} ${wsUrl}`.trimEnd()
          ].join("; ")
        ]
      }
    });
  });
}
function createTray() {
  const icon = electron.nativeImage.createEmpty();
  tray = new electron.Tray(icon);
  tray.setToolTip("Nodeira");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Open Nodeira",
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
function registerGlobalShortcuts() {
  electron.globalShortcut.register("Ctrl+Shift+Space", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  electron.globalShortcut.register("Ctrl+Shift+N", () => {
    if (!mainWindow) {
      createWindow();
      const win = mainWindow;
      win == null ? void 0 : win.webContents.once("did-finish-load", () => {
        win == null ? void 0 : win.webContents.send("new-note");
      });
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("new-note");
  });
}
function registerIpcHandlers() {
  electron.ipcMain.on("settings:getServerUrl", (event) => {
    event.returnValue = getSetting("serverUrl") ?? process.env["NODEIRA_SERVER_URL"] ?? "";
  });
  electron.ipcMain.handle("settings:setServerUrl", (_, url) => {
    const trimmed = url.trim();
    setSetting("serverUrl", trimmed);
    serverUrl = trimmed;
    wsUrl = trimmed.replace(/^http/, "ws");
    setImmediate(() => mainWindow == null ? void 0 : mainWindow.reload());
  });
  electron.ipcMain.handle("sqlite:loadYjsState", (_, noteId) => loadYjsState(noteId));
  electron.ipcMain.handle(
    "sqlite:saveYjsState",
    (_, noteId, state) => saveYjsState(noteId, state)
  );
  electron.ipcMain.handle("sqlite:getNoteMetadata", () => {
    return loadNoteMetadata().map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString()
    }));
  });
  electron.ipcMain.handle("sqlite:upsertNoteMetadata", (_, notes) => {
    const parsed = notes.map((n) => ({
      ...n,
      createdAt: new Date(n["createdAt"]),
      updatedAt: new Date(n["updatedAt"])
    }));
    upsertNoteMetadata(parsed);
  });
  electron.ipcMain.handle("plugin:getCachedBundle", (_, source) => getCachedBundle(source));
  electron.ipcMain.handle(
    "plugin:setCachedBundle",
    (_, source, bundle) => setCachedBundle(source, bundle)
  );
}
electron.app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
electron.app.whenReady().then(() => {
  openDatabase(electron.app.getPath("userData"));
  serverUrl = getSetting("serverUrl") ?? process.env["NODEIRA_SERVER_URL"] ?? "";
  wsUrl = serverUrl.replace(/^http/, "ws");
  registerIpcHandlers();
  createWindow();
  electron.Menu.setApplicationMenu(null);
  createTray();
  registerGlobalShortcuts();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow == null ? void 0 : mainWindow.show();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
