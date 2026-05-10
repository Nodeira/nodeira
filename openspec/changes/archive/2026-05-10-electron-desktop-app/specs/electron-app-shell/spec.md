## ADDED Requirements

### Requirement: Electron main process bootstraps a browser window

The main process SHALL create a `BrowserWindow` with `contextIsolation: true`, `sandbox: true`, and a preload script that exposes typed IPC channels via `contextBridge`. In production the window SHALL load the bundled renderer from `file://`. In development it SHALL load `http://localhost:5173`.

#### Scenario: App launches in production

- **WHEN** the packaged app is started
- **THEN** a single `BrowserWindow` opens loading the embedded `file://` build with no visible dev tooling

#### Scenario: App launches in development

- **WHEN** `NODE_ENV=development` and the Vite dev server is running
- **THEN** the `BrowserWindow` loads `http://localhost:5173` so HMR works

#### Scenario: Second launch when already running

- **WHEN** the user launches the app a second time
- **THEN** the existing window is focused and no second window is opened (single-instance lock)

---

### Requirement: Preload script exposes typed IPC channels only

The preload script SHALL use `contextBridge.exposeInMainWorld` to expose only explicitly named IPC channels. No `ipcRenderer` object SHALL be exposed directly to the renderer.

#### Scenario: Renderer calls an allowed IPC channel

- **WHEN** the renderer invokes a channel name defined in the preload bridge
- **THEN** the main process handler receives and processes the call

#### Scenario: Renderer attempts arbitrary IPC

- **WHEN** the renderer attempts to call a channel not exposed by `contextBridge`
- **THEN** the call is blocked and an error is thrown in the renderer

---

### Requirement: Native application menu

The main process SHALL register a native OS menu with at minimum: File (New Note, Quit), Edit (Undo, Redo, Cut, Copy, Paste), View (Toggle DevTools in dev only), and Help (About).

#### Scenario: Menu visible on app launch

- **WHEN** the app window opens
- **THEN** the OS-native menu bar is visible and functional

---

### Requirement: System tray icon with basic controls

The main process SHALL add a system tray icon. The tray context menu SHALL include "Open Nodeira" (focuses the window) and "Quit".

#### Scenario: Tray icon appears on launch

- **WHEN** the app starts
- **THEN** a system tray icon is present

#### Scenario: Window restore from tray

- **WHEN** the user clicks "Open Nodeira" in the tray menu
- **THEN** the main window is shown and focused

---

### Requirement: In-app keyboard shortcuts

The app SHALL register the following in-app accelerators via the native menu. These SHALL be active only when the Nodeira window is focused.

| Action                     | macOS          | Windows / Linux |
| -------------------------- | -------------- | --------------- |
| New Note                   | `Cmd+N`        | `Ctrl+N`        |
| Search Notes               | `Cmd+K`        | `Ctrl+K`        |
| Toggle Sidebar             | `Cmd+\`        | `Ctrl+\`        |
| Settings                   | `Cmd+,`        | `Ctrl+,`        |
| Toggle DevTools (dev only) | `Cmd+Option+I` | `Ctrl+Shift+I`  |

#### Scenario: New note via keyboard

- **WHEN** the user presses `Cmd/Ctrl+N` while the window is focused
- **THEN** a new note is created and opened in the editor

#### Scenario: Search via keyboard

- **WHEN** the user presses `Cmd/Ctrl+K` while the window is focused
- **THEN** the search/command palette overlay opens

#### Scenario: Sidebar toggle via keyboard

- **WHEN** the user presses `Cmd/Ctrl+\` while the window is focused
- **THEN** the sidebar visibility toggles

---

### Requirement: Global hotkeys registered via `globalShortcut`

The main process SHALL register global OS-level shortcuts that fire even when Nodeira is not the focused application. The default global shortcuts SHALL be:

| Action                           | Default shortcut   |
| -------------------------------- | ------------------ |
| Open / focus Nodeira             | `Ctrl+Shift+Space` |
| Open Nodeira and create new note | `Ctrl+Shift+N`     |

Global shortcuts SHALL be released when the app quits and re-registered on relaunch.

#### Scenario: Focus app from background via global shortcut

- **WHEN** the user presses `Ctrl+Shift+Space` while Nodeira is backgrounded or minimized
- **THEN** the Nodeira window is shown and brought to the foreground

#### Scenario: Create new note from outside the app

- **WHEN** the user presses `Ctrl+Shift+N` while Nodeira is in the background
- **THEN** the Nodeira window is focused AND a new note is created and opened

#### Scenario: Global shortcuts released on quit

- **WHEN** the app receives a quit signal
- **THEN** all global shortcuts are unregistered before the process exits

---

### Requirement: Electron Forge packaging produces distributable builds

The project SHALL be configured with Electron Forge and the `@electron-forge/plugin-vite` plugin. Running `pnpm run package` in `apps/desktop` SHALL produce installable artifacts for the current platform. CI SHALL build for Linux, Windows, and macOS.

#### Scenario: Local package build succeeds

- **WHEN** `pnpm run package` is executed in `apps/desktop`
- **THEN** a distributable installer/archive is produced in the `out/` directory

#### Scenario: Renderer entry is bundled into the package

- **WHEN** the packaged app is installed and launched
- **THEN** it runs without requiring an internet connection to load the UI
