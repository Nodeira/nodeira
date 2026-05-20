## ADDED Requirements

### Requirement: Note body content is readable as Markdown

The server SHALL accept `GET /notes/:id/content` and return `{ content: string }` where `content` is the note's body serialized to Markdown. If the note has no Yjs state, `content` SHALL be an empty string. The endpoint SHALL require authentication (JWT or API token) and SHALL enforce vault scope if the token is vault-scoped.

#### Scenario: Note with content returns Markdown

- **WHEN** `GET /notes/:id/content` is called for a note with Yjs state
- **THEN** the response is `{ content: "<markdown string>" }` with HTTP 200

#### Scenario: Note with no content returns empty string

- **WHEN** `GET /notes/:id/content` is called for a note where `yjs_state` is NULL
- **THEN** the response is `{ content: "" }` with HTTP 200

#### Scenario: Nonexistent note returns 404

- **WHEN** `GET /notes/:id/content` is called with an unknown note ID
- **THEN** the server returns 404

#### Scenario: Vault-scoped token cannot read content outside scope

- **WHEN** `GET /notes/:id/content` is called with a token scoped to vault A
- **AND** the note belongs to vault B
- **THEN** the server returns 403

### Requirement: Note body content is writable from Markdown

The server SHALL accept `PUT /notes/:id/content` with body `{ content: string }` where `content` is a Markdown string. The server SHALL convert the Markdown to a Yjs binary state using the conversion pipeline (remark → MDAST → TipTap JSON → Y.Doc) and overwrite `notes.yjs_state`. The endpoint SHALL require authentication and enforce vault scope.

#### Scenario: Writing Markdown persists as Yjs state

- **WHEN** `PUT /notes/:id/content` is called with `{ content: "# Hello\n\nWorld" }`
- **THEN** the note's `yjs_state` is updated and HTTP 200 is returned
- **AND** a subsequent `GET /notes/:id/content` returns Markdown equivalent to the input

#### Scenario: Writing empty string clears content

- **WHEN** `PUT /notes/:id/content` is called with `{ content: "" }`
- **THEN** the note's `yjs_state` is set to an empty Yjs document state

#### Scenario: Nonexistent note returns 404

- **WHEN** `PUT /notes/:id/content` is called with an unknown note ID
- **THEN** the server returns 404

#### Scenario: Vault-scoped token cannot write content outside scope

- **WHEN** `PUT /notes/:id/content` is called with a token scoped to vault A
- **AND** the note belongs to vault B
- **THEN** the server returns 403

### Requirement: Markdown conversion supports the StarterKit node set

The server's Markdown converter SHALL correctly round-trip the following elements between Markdown and Yjs/TipTap JSON:

- Headings: `#` (h1), `##` (h2), `###` (h3)
- Paragraphs (blank-line separated)
- Bold: `**text**`
- Italic: `*text*`
- Inline code: `` `code` ``
- Fenced code blocks with optional language: ` ```lang `
- Unordered lists: `- item` or `* item`
- Ordered lists: `1. item`
- Blockquotes: `> text`
- Horizontal rules: `---`
- Links: `[text](url)`

Elements outside this set (tables, task lists, images, strikethrough) SHALL be preserved as-is in the Markdown string on read but are not guaranteed to round-trip correctly on write.

#### Scenario: Heading round-trips correctly

- **WHEN** `PUT /notes/:id/content` is called with `{ content: "# My Title" }`
- **AND** `GET /notes/:id/content` is called
- **THEN** the returned `content` contains `# My Title`

#### Scenario: Bold and italic marks round-trip

- **WHEN** content `"**bold** and *italic*"` is written and then read back
- **THEN** the returned Markdown contains the same bold and italic markers

#### Scenario: Code block with language round-trips

- **WHEN** content includes a fenced code block tagged with a language (e.g., `typescript`)
- **AND** that content is written then read back
- **THEN** the language annotation is preserved in the returned Markdown

#### Scenario: Nested list round-trips

- **WHEN** content includes a bullet list with multiple items
- **AND** that content is written then read back
- **THEN** the list items appear in the same order in the returned Markdown
