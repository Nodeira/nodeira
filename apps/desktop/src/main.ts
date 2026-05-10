import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  session,
  nativeImage,
} from "electron";
import path from "path";
import {
  openDatabase,
  loadYjsState,
  saveYjsState,
  loadNoteMetadata,
  upsertNoteMetadata,
  getCachedBundle,
  setCachedBundle,
  getSetting,
  setSetting,
} from "./db/database.js";
import type { NoteMetadata } from "@nodeira/shared-types";

// Handle Squirrel events on Windows (installer lifecycle)
if (process.platform === "win32" && process.argv.some((a) => a.startsWith("--squirrel"))) {
  app.quit();
  process.exit(0);
}

// ── Single instance ───────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;
let serverUrl = "";
let wsUrl = "";

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): void {
  setupCSP();

  mainWindow = new BrowserWindow({
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
      sandbox: true,
    },
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    const distPath = path.join(process.resourcesPath, "dist");
    void mainWindow.loadFile(path.join(distPath, "index.html"));
  }

  // F12 toggles DevTools in both dev and prod builds. Using before-input-event
  // rather than globalShortcut so it works regardless of OS focus state.
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Keep window hidden on close (macOS convention), only quit via menu/tray
  mainWindow.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// ── CSP ───────────────────────────────────────────────────────────────────────

function setupCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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
            `connect-src 'self' file: http://localhost:* ws://localhost:* wss://localhost:* https://cdn.jsdelivr.net ${serverUrl} ${wsUrl}`.trimEnd(),
          ].join("; "),
        ],
      },
    });
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("Nodeira");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Nodeira",
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Global shortcuts ──────────────────────────────────────────────────────────

function registerGlobalShortcuts(): void {
  globalShortcut.register("Ctrl+Shift+Space", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  globalShortcut.register("Ctrl+Shift+N", () => {
    if (!mainWindow) {
      createWindow();
      // mainWindow is set by createWindow(); capture before the async boundary
      const win = mainWindow as BrowserWindow | null;
      win?.webContents.once("did-finish-load", () => {
        win?.webContents.send("new-note");
      });
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("new-note");
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Settings
  ipcMain.on("settings:getServerUrl", (event) => {
    // Always read from DB so the reloaded preload sees the persisted value
    event.returnValue = getSetting("serverUrl") ?? process.env["NODEIRA_SERVER_URL"] ?? "";
  });

  ipcMain.handle("settings:setServerUrl", (_, url: string) => {
    const trimmed = url.trim();
    setSetting("serverUrl", trimmed);
    serverUrl = trimmed;
    wsUrl = trimmed.replace(/^http/, "ws");
    // Defer reload so the IPC response is sent before the renderer tears down
    setImmediate(() => mainWindow?.reload());
  });

  // SQLite — Yjs state
  ipcMain.handle("sqlite:loadYjsState", (_, noteId: string) => loadYjsState(noteId));

  ipcMain.handle("sqlite:saveYjsState", (_, noteId: string, state: Uint8Array) =>
    saveYjsState(noteId, state),
  );

  // SQLite — note metadata
  ipcMain.handle("sqlite:getNoteMetadata", () => {
    // Dates are serialised as ISO strings over IPC (JSON)
    return loadNoteMetadata().map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  });

  ipcMain.handle("sqlite:upsertNoteMetadata", (_, notes: unknown[]) => {
    const parsed = (notes as Array<Record<string, unknown>>).map((n) => ({
      ...(n as NoteMetadata),
      createdAt: new Date(n["createdAt"] as string),
      updatedAt: new Date(n["updatedAt"] as string),
    }));
    upsertNoteMetadata(parsed);
  });

  // Plugin cache
  ipcMain.handle("plugin:getCachedBundle", (_, source: string) => getCachedBundle(source));

  ipcMain.handle("plugin:setCachedBundle", (_, source: string, bundle: string) =>
    setCachedBundle(source, bundle),
  );
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  openDatabase(app.getPath("userData"));
  serverUrl = getSetting("serverUrl") ?? process.env["NODEIRA_SERVER_URL"] ?? "";
  wsUrl = serverUrl.replace(/^http/, "ws");
  registerIpcHandlers();
  createWindow();
  Menu.setApplicationMenu(null);
  createTray();
  registerGlobalShortcuts();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
