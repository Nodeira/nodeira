## ADDED Requirements

### Requirement: App detects online/offline state and exposes it to the renderer

The renderer SHALL listen to `window` `online` and `offline` events. It SHALL additionally treat the Yjs WebSocket entering a permanently-disconnected state as an offline signal. The combined online/offline state SHALL be stored in a Jotai atom (`networkStatusAtom`) readable by all UI components.

#### Scenario: Network goes offline while app is open

- **WHEN** the system network interface goes down
- **THEN** `networkStatusAtom` transitions to `"offline"` within 2 seconds

#### Scenario: Network comes back online

- **WHEN** the system network interface is restored
- **THEN** `networkStatusAtom` transitions to `"online"`

---

### Requirement: Offline status is visible in the UI

The app SHALL display a persistent, non-blocking indicator (e.g. a status bar badge or header chip) when `networkStatusAtom` is `"offline"`. The indicator SHALL disappear when connectivity is restored.

#### Scenario: Offline indicator shown

- **WHEN** `networkStatusAtom` is `"offline"`
- **THEN** an offline status indicator is visible in the app chrome

#### Scenario: Offline indicator hidden when online

- **WHEN** `networkStatusAtom` transitions to `"online"`
- **THEN** the offline indicator is no longer visible

---

### Requirement: Notes remain editable while offline

While offline, the editor SHALL remain fully functional. All changes SHALL be persisted to SQLite via the existing `SqliteYjsPersistence` layer. No error or read-only state SHALL be imposed on the editor due to the absence of a server connection.

#### Scenario: Edit a note while offline

- **WHEN** `networkStatusAtom` is `"offline"` and the user edits a note
- **THEN** changes are accepted by the editor and written to SQLite without error

---

### Requirement: Yjs and REST state sync automatically on reconnect

When `networkStatusAtom` transitions to `"online"`, the app SHALL:

1. Allow the `y-websocket` provider to reconnect (it retries automatically; no manual intervention needed)
2. Re-fetch `GET /notes` to refresh the notes list metadata cache

#### Scenario: Yjs sync resumes after reconnect

- **WHEN** the app comes back online after editing a note offline
- **THEN** the Yjs WebSocket reconnects and merges local changes with the server without data loss

#### Scenario: Notes list refreshes after reconnect

- **WHEN** the app comes back online
- **THEN** `GET /notes` is re-fetched and the sidebar list reflects any server-side changes
