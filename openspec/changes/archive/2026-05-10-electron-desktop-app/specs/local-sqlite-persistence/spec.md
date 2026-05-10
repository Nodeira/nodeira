## ADDED Requirements

### Requirement: `SqliteYjsPersistence` stores and restores Yjs document state

The main process SHALL implement a `SqliteYjsPersistence` class backed by `better-sqlite3`. It SHALL store Yjs binary state as a BLOB keyed by `noteId` in a `yjs_state` table. On document load it SHALL apply the stored state to the Y.Doc before the WebSocket connects. On document update it SHALL persist the encoded state with a debounce of ≤ 1 second.

#### Scenario: Note content survives app restart without server

- **WHEN** the user edits a note, closes the app, and relaunches without a server connection
- **THEN** the note content is restored from SQLite exactly as it was when the app closed

#### Scenario: Yjs state is debounced on rapid edits

- **WHEN** the user types continuously for several seconds
- **THEN** SQLite writes occur no more than once per second, not on every keystroke

---

### Requirement: Note metadata is cached locally for offline list rendering

The main process SHALL maintain a `note_metadata` table in SQLite mirroring the fields returned by `GET /notes` (noteId, title, folderId, createdAt, updatedAt, sortOrder). This cache SHALL be updated whenever the REST API responds successfully.

#### Scenario: Notes list renders while offline

- **WHEN** the app launches with no server connection
- **THEN** the sidebar notes list renders from the SQLite metadata cache without a loading error

#### Scenario: Cache updated after successful API response

- **WHEN** `GET /notes` returns successfully
- **THEN** the local `note_metadata` table is overwritten with the fresh response

---

### Requirement: SQLite database file is stored in the OS user data directory

The `better-sqlite3` database file SHALL be opened at `app.getPath('userData')/nodeira.db`. The directory SHALL be created if it does not exist.

#### Scenario: Database file location on first launch

- **WHEN** the app is launched for the first time
- **THEN** `nodeira.db` is created inside the OS user data directory (e.g. `~/.config/Nodeira/` on Linux, `%APPDATA%\Nodeira\` on Windows, `~/Library/Application Support/Nodeira/` on macOS)

---

### Requirement: IPC channels bridge renderer to the SQLite main process

The preload script SHALL expose the following channels via `contextBridge`:

- `sqlite:loadYjsState(noteId)` → `Uint8Array | null`
- `sqlite:saveYjsState(noteId, state: Uint8Array)` → `void`
- `sqlite:getNoteMetadata()` → `NoteMetadata[]`
- `sqlite:upsertNoteMetadata(notes: NoteMetadata[])` → `void`

#### Scenario: Renderer loads Yjs state via IPC

- **WHEN** the renderer invokes `sqlite:loadYjsState` with a valid noteId
- **THEN** the main process returns the stored binary state or `null` if none exists

#### Scenario: Renderer saves Yjs state via IPC

- **WHEN** the renderer invokes `sqlite:saveYjsState` with a noteId and state buffer
- **THEN** the main process persists the buffer to SQLite and returns without error
