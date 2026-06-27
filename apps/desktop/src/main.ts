import {
  app,
  BrowserWindow,
  Menu,
  Notification,
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

type KeybindAction = "newNote" | "newQuickNote";
type Keybinds = Record<KeybindAction, string>;

const DEFAULT_KEYBINDS: Keybinds = {
  newNote: "CommandOrControl+Shift+N",
  newQuickNote: "CommandOrControl+Shift+Q",
};

// Maps each rebindable action to the renderer channel its handler fires.
const KEYBIND_CHANNELS: Record<KeybindAction, string> = {
  newNote: "new-note",
  newQuickNote: "new-quick-note",
};

let keybinds: Keybinds = { ...DEFAULT_KEYBINDS };

function loadKeybinds(): Keybinds {
  return {
    newNote: getSetting("keybind.newNote") ?? DEFAULT_KEYBINDS.newNote,
    newQuickNote: getSetting("keybind.newQuickNote") ?? DEFAULT_KEYBINDS.newQuickNote,
  };
}

/** Bring the window forward, creating it if it was closed. */
function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** Focus the window, then notify the renderer over `channel`. */
function focusAndSend(channel: string): void {
  if (!mainWindow) {
    createWindow();
    // mainWindow is set synchronously by createWindow(); the page is not yet
    // loaded, so defer the send until the renderer is ready to receive it.
    const win = mainWindow as BrowserWindow | null;
    win?.webContents.once("did-finish-load", () => {
      win?.webContents.send(channel);
    });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send(channel);
}

/**
 * Re-register all global shortcuts from the current `keybinds`. Returns which
 * actions registered successfully — `false` means the OS rejected the
 * accelerator (most often because another app already owns it).
 */
function registerGlobalShortcuts(): Record<KeybindAction, boolean> {
  globalShortcut.unregisterAll();

  // Fixed "show app" shortcut — not user-rebindable.
  globalShortcut.register("CommandOrControl+Shift+Space", showMainWindow);

  const result: Record<KeybindAction, boolean> = { newNote: true, newQuickNote: true };
  for (const action of Object.keys(KEYBIND_CHANNELS) as KeybindAction[]) {
    const accelerator = keybinds[action]?.trim();
    if (!accelerator) {
      result[action] = false;
      continue;
    }
    const channel = KEYBIND_CHANNELS[action];
    try {
      result[action] = globalShortcut.register(accelerator, () => focusAndSend(channel));
    } catch {
      // register() throws on a malformed accelerator string
      result[action] = false;
    }
  }
  return result;
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

  // Keybinds — read synchronously so preload can expose them at startup
  ipcMain.on("settings:getKeybinds", (event) => {
    event.returnValue = keybinds;
  });

  ipcMain.handle("settings:setKeybinds", (_, next: Partial<Keybinds>) => {
    keybinds = {
      newNote: (next.newNote ?? "").trim(),
      newQuickNote: (next.newQuickNote ?? "").trim(),
    };
    setSetting("keybind.newNote", keybinds.newNote);
    setSetting("keybind.newQuickNote", keybinds.newQuickNote);
    return registerGlobalShortcuts();
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

  // Native reminder notification — shows even when minimized to tray; clicking
  // it brings the window forward.
  ipcMain.handle("notification:show", (_, payload: { title: string; body?: string }) => {
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: payload.title,
      body: payload.body ?? "",
    });
    notification.on("click", () => {
      if (!mainWindow) {
        createWindow();
        return;
      }
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    });
    notification.show();
  });
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
  keybinds = loadKeybinds();
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
