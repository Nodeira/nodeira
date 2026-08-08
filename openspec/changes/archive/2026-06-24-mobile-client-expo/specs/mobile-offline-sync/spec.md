## ADDED Requirements

### Requirement: App detects network state using `@react-native-community/netinfo`

The mobile app SHALL subscribe to `NetInfo.addEventListener` on startup. The current network reachability state SHALL be stored in a Jotai atom (`networkStatusAtom`: `"online" | "offline"`). Any component can read `networkStatusAtom` to adjust its UI.

#### Scenario: Device goes offline

- **WHEN** the device loses network connectivity
- **THEN** `networkStatusAtom` transitions to `"offline"` within 2 seconds

#### Scenario: Device comes back online

- **WHEN** the device regains network connectivity
- **THEN** `networkStatusAtom` transitions to `"online"`

---

### Requirement: Offline status is visible in the app UI

The app SHALL display a non-blocking banner or status bar indicator when `networkStatusAtom` is `"offline"`. The indicator SHALL disappear automatically when connectivity is restored.

#### Scenario: Offline banner shown

- **WHEN** `networkStatusAtom` is `"offline"`
- **THEN** an offline indicator is visible in the app chrome on all screens

#### Scenario: Offline banner dismissed when online

- **WHEN** `networkStatusAtom` transitions to `"online"`
- **THEN** the offline indicator is no longer visible

---

### Requirement: Notes remain fully editable while offline

While offline, the editor SHALL remain functional and accept all user input. Changes SHALL be persisted to AsyncStorage via `AsyncStorageYjsPersistence`. No error message or read-only mode SHALL be imposed on the editor solely due to lack of network connectivity.

#### Scenario: Edit a note while offline

- **WHEN** `networkStatusAtom` is `"offline"` and the user types in the editor
- **THEN** the text appears in the editor and is saved to AsyncStorage

---

### Requirement: WebSocket reconnects automatically when the app returns to the foreground

The `WebsocketProvider` SHALL be connected when the app enters the foreground (via `AppState` event `active`) and its connection SHALL be closed or paused when the app enters the background (`background` state). On reconnect, Yjs SHALL automatically merge any offline changes with the server state.

#### Scenario: Offline edits sync after reconnect

- **WHEN** the user edits a note while offline, then the device reconnects to the network and the app is foregrounded
- **THEN** the offline edits appear on the server and in other connected clients within 5 seconds of reconnect

#### Scenario: WebSocket does not run in the background

- **WHEN** the app enters the background state
- **THEN** the WebSocket connection is closed or suspended and no further data is sent or received

---

### Requirement: Sync conflict resolution is handled by Yjs CRDT merge

The app SHALL NOT implement any custom conflict resolution logic. When two clients have diverged (e.g., offline edits on mobile and simultaneous edits on web), the Yjs CRDT merge SHALL produce a deterministic result. The merged state SHALL be visible in the editor immediately after the WebSocket reconnects.

#### Scenario: Concurrent edits on mobile and web merge correctly

- **WHEN** the user edits paragraph A on mobile while offline, and a web client edits paragraph B of the same note simultaneously
- **THEN** after mobile reconnects, the editor shows both paragraph A and paragraph B edits without data loss
