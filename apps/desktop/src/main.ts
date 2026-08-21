import {
  app,
  autoUpdater,
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
import started from "electron-squirrel-startup";

// electron-squirrel-startup creates/removes the Start Menu & Desktop shortcuts
// for --squirrel-install/-updated/-uninstall/-obsolete and quits for those.
// It does NOT match --squirrel-firstrun, which is how Setup.exe launches the
// app immediately after a fresh install — that launch must run normally.
if (started) {
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

// ── Auto-update ───────────────────────────────────────────────────────────────

// update.electronjs.org reads GitHub Releases directly; it has no concept of a Linux
// package feed, so the built-in autoUpdater simply isn't usable on that platform.
const UPDATE_SUPPORTED = process.platform !== "linux";
const UPDATE_FEED_BASE = "https://update.electronjs.org/Nodeira/nodeira";
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function updateFeedUrl(): string {
  return `${UPDATE_FEED_BASE}/${process.platform}-${process.arch}/${app.getVersion()}`;
}

/**
 * Peeks at the update feed's JSON without downloading anything. autoUpdater itself has no
 * "available but not yet downloading" state — checkForUpdates() starts pulling the update
 * immediately — so a plain fetch against the same feed URL is how we learn the version to
 * show the user before they've committed to a download.
 */
async function checkForUpdate(): Promise<void> {
  if (!UPDATE_SUPPORTED || !app.isPackaged || !mainWindow) return;
  try {
    const response = await fetch(updateFeedUrl());
    if (response.status === 204) {
      mainWindow.webContents.send("update:not-available");
      return;
    }
    if (!response.ok) throw new Error(`Update feed returned ${response.status}`);
    const body = (await response.json()) as { name?: string; notes?: string };
    mainWindow.webContents.send("update:available", {
      version: body.name ?? "",
      notes: body.notes ?? "",
    });
  } catch (error) {
    mainWindow.webContents.send("update:error", (error as Error).message);
  }
}

/** Kicks off the real Squirrel-backed download; resolves once started, not once finished. */
function startUpdateDownload(): void {
  if (!UPDATE_SUPPORTED || !app.isPackaged) return;
  autoUpdater.setFeedURL({ url: updateFeedUrl() });
  autoUpdater.checkForUpdates();
}

function registerAutoUpdaterListeners(): void {
  if (!UPDATE_SUPPORTED) return;
  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update:downloaded");
  });
  autoUpdater.on("error", (error) => {
    mainWindow?.webContents.send("update:error", error.message);
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

  // Auto-update
  ipcMain.on("app:getVersion", (event) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.handle("update:check", () => checkForUpdate());
  ipcMain.handle("update:download", () => startUpdateDownload());
  ipcMain.handle("update:install", () => autoUpdater.quitAndInstall());

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
  registerAutoUpdaterListeners();
  if (UPDATE_SUPPORTED && app.isPackaged) {
    // Delay the first check past startup so it doesn't contend with window/DB init.
    setTimeout(() => void checkForUpdate(), 10_000);
    setInterval(() => void checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
  }

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
