## ADDED Requirements

### Requirement: CLI authenticates via interactive login or token

The CLI SHALL support two authentication paths:

1. `nodeira login` — prompts for URL, email, and password interactively; stores the resulting JWT to `~/.config/nodeira/config.json`.
2. `nodeira login --token <value>` — stores the provided token (JWT or `ndra_...` API token) directly to config without prompting for credentials.

The env vars `NODEIRA_URL` and `NODEIRA_TOKEN` SHALL override config file values for all commands.

#### Scenario: Interactive login stores JWT

- **WHEN** `nodeira login` is run and the user enters valid credentials
- **THEN** the JWT is written to `~/.config/nodeira/config.json` under key `token`
- **AND** subsequent commands use that token without re-prompting

#### Scenario: Token flag skips credential prompt

- **WHEN** `nodeira login --token ndra_abc123` is run
- **THEN** the token is written to config and no email/password is requested

#### Scenario: Env var overrides config file

- **WHEN** `NODEIRA_TOKEN=ndra_xyz` is set in the environment
- **AND** config file also contains a different token
- **THEN** the env var value is used for the request

### Requirement: CLI enforces read-only mode via NODEIRA_MODE

When `NODEIRA_MODE=ro` is set, the CLI SHALL refuse to execute any command that would create, update, or delete a resource. It SHALL print a human-readable error and exit with code 2. Read commands (list, get) SHALL work normally in RO mode.

#### Scenario: Write command is blocked in RO mode

- **WHEN** `NODEIRA_MODE=ro nodeira notes create --title "Test"` is run
- **THEN** the CLI prints an error indicating RO mode is active and exits with code 2

#### Scenario: Read command succeeds in RO mode

- **WHEN** `NODEIRA_MODE=ro nodeira notes list` is run
- **THEN** the CLI executes normally and returns results

### Requirement: CLI outputs JSON by default with optional pretty formatting

All commands SHALL output JSON to stdout by default. With the `--pretty` flag, commands SHALL output human-readable formatted text (tables for lists, indented key-value for single resources). Errors SHALL be written to stderr as `{ "error": "<message>" }` in JSON mode or as plain text in pretty mode.

#### Scenario: Default output is JSON

- **WHEN** `nodeira notes list` is run without flags
- **THEN** stdout contains a valid JSON array

#### Scenario: Pretty flag formats as table

- **WHEN** `nodeira notes list --pretty` is run
- **THEN** stdout contains a human-readable table with column headers

#### Scenario: Error is written to stderr

- **WHEN** any command fails (e.g., 404 from server)
- **THEN** stdout is empty and stderr contains an error message
- **AND** the exit code is non-zero

### Requirement: CLI manages API tokens

The CLI SHALL provide `nodeira token create`, `nodeira token list`, and `nodeira token revoke` commands. `token create` SHALL accept `--name`, optional `--vault <vaultId>`, and optional `--expires <duration>` (e.g., `30d`, `1y`). On success it SHALL print the raw token value and warn that it will not be shown again.

#### Scenario: Token create prints raw token

- **WHEN** `nodeira token create --name "agent"` is run
- **THEN** stdout contains `{ "id": "...", "token": "ndra_...", ... }`
- **AND** a warning is printed that the token cannot be retrieved again

#### Scenario: Token create with vault scope

- **WHEN** `nodeira token create --name "scoped" --vault vault-123` is run
- **THEN** the response includes `"vaultId": "vault-123"`

#### Scenario: Token list shows existing tokens without raw values

- **WHEN** `nodeira token list` is run
- **THEN** stdout contains an array of tokens with `id`, `name`, `vaultId`, `createdAt`, `lastUsedAt` but no `token` field

#### Scenario: Token revoke deletes the token

- **WHEN** `nodeira token revoke <id>` is run
- **THEN** the token is deleted and `{}` or a success message is returned

### Requirement: CLI manages notes with content support

The CLI SHALL provide `nodeira notes list`, `notes get`, `notes create`, `notes update`, and `notes delete`. `notes get` SHALL accept `--content` to include the note body as Markdown. `notes create` and `notes update` SHALL accept `--content <text>`, `--content-file <path>`, or `--content-file -` (read from stdin) to set the note body.

#### Scenario: notes get with --content includes Markdown body

- **WHEN** `nodeira notes get <id> --content` is run
- **THEN** the JSON response includes a `content` field with the Markdown body

#### Scenario: notes create with --content-file reads from stdin

- **WHEN** `echo "# Hello" | nodeira notes create --title "My Note" --content-file -` is run
- **THEN** the note is created with the piped Markdown as its body

#### Scenario: notes list filters by vault

- **WHEN** `nodeira notes list --vault <vaultId>` is run
- **THEN** only notes in that vault are returned

### Requirement: CLI provides config and vault/folder commands

The CLI SHALL provide:

- `nodeira config set-url <url>` — writes the server URL to config
- `nodeira folders list [--vault <id>]` — lists folders
- `nodeira vaults list` — lists vaults

#### Scenario: config set-url persists URL

- **WHEN** `nodeira config set-url https://mynodeira.example.com` is run
- **THEN** `~/.config/nodeira/config.json` contains `"url": "https://mynodeira.example.com"`

#### Scenario: vaults list returns vault array

- **WHEN** `nodeira vaults list` is run against an authenticated server
- **THEN** stdout contains a JSON array of vault objects
