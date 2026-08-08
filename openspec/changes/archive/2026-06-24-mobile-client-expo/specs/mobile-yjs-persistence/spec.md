## ADDED Requirements

### Requirement: `AsyncStorageYjsPersistence` provides offline Yjs state storage on mobile

A class `AsyncStorageYjsPersistence` SHALL be implemented in `apps/mobile/src/providers/AsyncStorageYjsPersistence.ts`. It SHALL accept a `Y.Doc` and a `noteId` string. On construction it SHALL load any previously persisted Yjs binary state from AsyncStorage and apply it to the doc via `Y.applyUpdate`. It SHALL subscribe to `Y.Doc` updates and write the full encoded state back to AsyncStorage within 500 ms (debounced). It SHALL expose a `destroy()` method that unsubscribes all listeners and cancels pending writes.

#### Scenario: Persisted state is restored after app restart

- **WHEN** the user edits a note, backgrounds the app, and relaunches
- **THEN** the note editor shows the previously entered content without requiring a server round-trip

#### Scenario: Doc update is persisted within debounce window

- **WHEN** the user types in the editor
- **THEN** the updated Yjs state is written to AsyncStorage within 500 ms of the last keystroke

#### Scenario: Destroy stops further writes

- **WHEN** `destroy()` is called on the persistence provider
- **THEN** subsequent doc updates are not written to AsyncStorage

---

### Requirement: AsyncStorage key schema is namespaced per note

AsyncStorage keys SHALL follow the pattern `yjs_state_<noteId>` (e.g., `yjs_state_abc123`). No other AsyncStorage keys SHALL begin with the prefix `yjs_state_`.

#### Scenario: Two notes do not share the same storage key

- **WHEN** two different notes are opened and edited
- **THEN** their Yjs states are stored under distinct keys and do not overwrite each other

---

### Requirement: A module-level `YjsContext` cache prevents duplicate Y.Doc instances

A module-level `Map<noteId, YjsContext>` (mirroring the web `YjsProvider.ts` pattern) SHALL be maintained in `apps/mobile/src/providers/YjsProvider.ts`. `YjsContext` SHALL contain the `Y.Doc`, the `AsyncStorageYjsPersistence` instance, and the `WebsocketProvider`. Navigating back to a previously opened note SHALL reuse the cached context rather than creating a new doc.

#### Scenario: Navigating away and back does not reconnect WebSocket

- **WHEN** the user opens note A, navigates to the note list, then reopens note A
- **THEN** the same `Y.Doc` and WebSocket connection are reused (no duplicate connection is established)

---

### Requirement: Persistence provider handles missing or corrupt stored state gracefully

If the value retrieved from AsyncStorage is `null`, empty, or cannot be parsed as a valid Yjs update, the persistence provider SHALL initialize with an empty doc and SHALL log a warning. It SHALL NOT throw or crash the app.

#### Scenario: Missing storage key initializes empty doc

- **WHEN** a note is opened for the first time (no AsyncStorage entry exists)
- **THEN** the editor opens with an empty document without errors

#### Scenario: Corrupt data is handled gracefully

- **WHEN** the AsyncStorage entry for a note contains non-Yjs binary data
- **THEN** the provider logs a warning and initializes an empty doc
