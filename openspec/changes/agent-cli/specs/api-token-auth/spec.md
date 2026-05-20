## ADDED Requirements

### Requirement: User can create a named API token

The server SHALL accept `POST /auth/tokens` with a JSON body `{ name: string, vaultId?: string, expiresAt?: string }`. It SHALL generate a cryptographically random token with the format `ndra_<64 hex chars>`, store only its SHA-256 hash in the `api_tokens` table, and return `{ id, name, token, vaultId, createdAt, expiresAt }` where `token` is the raw value. The raw token SHALL NOT be stored and SHALL NOT be retrievable after this response.

#### Scenario: Token created with vault scope

- **WHEN** `POST /auth/tokens` is called with `{ name: "agent", vaultId: "vault-123" }`
- **THEN** a row is inserted with `vault_id = "vault-123"` and the raw token is returned in the response body exactly once

#### Scenario: Token created without vault scope

- **WHEN** `POST /auth/tokens` is called with `{ name: "admin-agent" }` and no `vaultId`
- **THEN** a row is inserted with `vault_id = NULL` and the raw token is returned

#### Scenario: Token created with expiry

- **WHEN** `POST /auth/tokens` is called with `{ name: "temp", expiresAt: "2027-01-01T00:00:00Z" }`
- **THEN** a row is inserted with `expires_at` set to the specified timestamp

### Requirement: User can list their API tokens

The server SHALL accept `GET /auth/tokens` and return an array of `{ id, name, vaultId, createdAt, lastUsedAt, expiresAt }` for the authenticated user. The raw token value SHALL NOT appear in list responses.

#### Scenario: List returns tokens for current user only

- **WHEN** `GET /auth/tokens` is called by user A
- **THEN** only tokens belonging to user A are returned, even if other users have tokens

### Requirement: User can revoke an API token

The server SHALL accept `DELETE /auth/tokens/:id` and permanently delete the token row. Subsequent requests using that token SHALL be rejected with 401.

#### Scenario: Revoked token is rejected

- **WHEN** a token is deleted via `DELETE /auth/tokens/:id`
- **AND** a subsequent request uses that token as Bearer auth
- **THEN** the server returns 401

### Requirement: API tokens authenticate requests

The server SHALL recognize Bearer tokens with the `ndra_` prefix as API tokens. On each request, the SHA-256 hash of the incoming token SHALL be looked up in `api_tokens`. If found and not expired, the request SHALL be authenticated as the token's owner user. The token's `last_used_at` SHALL be updated on each successful authentication.

#### Scenario: Valid API token authenticates

- **WHEN** a request carries `Authorization: Bearer ndra_<valid token>`
- **THEN** the request is authenticated as the token owner and proceeds normally

#### Scenario: Expired API token is rejected

- **WHEN** a request carries a token whose `expires_at` is in the past
- **THEN** the server returns 401

#### Scenario: Unknown token is rejected

- **WHEN** a request carries `Authorization: Bearer ndra_<unknown token>`
- **THEN** the server returns 401

#### Scenario: JWT tokens continue to work unchanged

- **WHEN** a request carries a standard JWT Bearer token (not `ndra_` prefixed)
- **THEN** existing JWT verification logic handles it; API token logic is not invoked

### Requirement: Vault-scoped tokens restrict note access

When an API token has a non-null `vaultId`, the server SHALL enforce that all note and folder operations are restricted to that vault. Requests targeting resources outside the scoped vault SHALL be rejected with 403.

#### Scenario: Scoped token cannot read notes from another vault

- **WHEN** a request authenticated by a token scoped to vault A calls `GET /notes/:id`
- **AND** the note belongs to vault B
- **THEN** the server returns 403

#### Scenario: Scoped token note list is filtered to its vault

- **WHEN** a request authenticated by a token scoped to vault A calls `GET /notes` (with no vaultId query param)
- **THEN** only notes belonging to vault A are returned

#### Scenario: Scoped token cannot create note in another vault

- **WHEN** a request authenticated by a token scoped to vault A calls `POST /notes` with `vaultId: "vault-B"`
- **THEN** the server returns 403

#### Scenario: Scoped token vault list returns only its vault

- **WHEN** a request authenticated by a token scoped to vault A calls `GET /vaults`
- **THEN** only vault A is returned in the response

#### Scenario: Unscoped token has full access

- **WHEN** a request authenticated by a token with null `vaultId` calls any note/folder/vault endpoint
- **THEN** no additional vault restriction is applied beyond normal auth
