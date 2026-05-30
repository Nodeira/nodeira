## ADDED Requirements

### Requirement: Canvas CRUD API
The system SHALL expose a REST API under `/api/v1/canvases` for creating, reading, updating, and deleting canvases. All endpoints SHALL require JWT authentication and enforce vault-level access scoping consistent with the notes API.

#### Scenario: Create canvas
- **WHEN** an authenticated user sends `POST /api/v1/canvases` with `{ title?, vaultId? }`
- **THEN** the system creates a new canvas with an empty `data` object (`{ nodes: [], edges: [] }`) and returns the full canvas record with HTTP 201

#### Scenario: List canvases by vault
- **WHEN** an authenticated user sends `GET /api/v1/canvases?vaultId=<id>`
- **THEN** the system returns an array of canvases belonging to that vault, sorted by `position` ascending

#### Scenario: List all canvases
- **WHEN** an authenticated user sends `GET /api/v1/canvases` with no `vaultId` filter
- **THEN** the system returns all canvases accessible to the user's token scope

#### Scenario: Get single canvas
- **WHEN** an authenticated user sends `GET /api/v1/canvases/:id`
- **THEN** the system returns the full canvas record including the `data` JSON field

#### Scenario: Get canvas not owned by user
- **WHEN** an authenticated user requests a canvas that belongs to a vault outside their token scope
- **THEN** the system returns HTTP 403

#### Scenario: Update canvas data
- **WHEN** an authenticated user sends `PATCH /api/v1/canvases/:id` with `{ data: <CanvasData> }`
- **THEN** the system replaces the canvas `data` field with the new value and returns the updated record

#### Scenario: Update canvas metadata
- **WHEN** an authenticated user sends `PATCH /api/v1/canvases/:id` with `{ title?, pinned?, icon? }`
- **THEN** the system updates the specified metadata fields, leaving `data` unchanged

#### Scenario: Delete canvas
- **WHEN** an authenticated user sends `DELETE /api/v1/canvases/:id`
- **THEN** the system deletes the canvas record and returns HTTP 204

### Requirement: Canvas data conforms to JSON Canvas spec
The `data` field stored and returned by the API SHALL conform to the [JSON Canvas spec](https://jsoncanvas.org/) with one extension: an `"image"` node type with a `url` string field. The API SHALL not validate the internal structure of `data` beyond it being valid JSON — schema validation is the client's responsibility.

#### Scenario: Store JSON Canvas spec document
- **WHEN** a client sends a `PATCH` request with a `data` field containing valid JSON Canvas nodes and edges
- **THEN** the system persists and returns the same JSON without modification

#### Scenario: Store canvas with image extension nodes
- **WHEN** a client sends canvas `data` containing nodes with `type: "image"` and a `url` field
- **THEN** the system stores and returns the data unchanged (no unknown-type rejection)

### Requirement: Canvas belongs to Vault
The system SHALL associate each canvas with an optional vault via `vaultId`. API token vault scoping SHALL be enforced: a token scoped to vault A SHALL NOT be able to read or modify canvases in vault B.

#### Scenario: Token scoped to vault
- **WHEN** an API token scoped to vault A requests `GET /api/v1/canvases`
- **THEN** only canvases with `vaultId = vaultA.id` are returned
