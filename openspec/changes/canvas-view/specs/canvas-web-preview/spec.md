## ADDED Requirements

### Requirement: URL metadata proxy endpoint
The system SHALL expose `POST /api/v1/canvases/preview` that accepts `{ url: string }` and returns Open Graph metadata for that URL. The request is made server-side to avoid CORS restrictions. The endpoint SHALL be authenticated.

#### Scenario: Fetch valid URL with OG tags
- **WHEN** an authenticated user posts `{ url: "https://example.com/article" }` to the preview endpoint
- **THEN** the system fetches the URL, parses the HTML, and returns `{ title, description, image, favicon, url }` where fields are populated from `og:title`, `og:description`, `og:image`, and the site favicon respectively

#### Scenario: Fetch URL missing OG tags
- **WHEN** the target page has no OG meta tags
- **THEN** the system falls back to `<title>` for `title`, `<meta name="description">` for `description`, and `null` for `image` and `favicon`

#### Scenario: Fetch URL that is unreachable
- **WHEN** the target URL returns a non-2xx status or the request times out (5 second timeout)
- **THEN** the endpoint returns HTTP 422 with `{ error: "Could not fetch URL" }` and the client shows the URL as plain text instead

#### Scenario: Relative og:image URL
- **WHEN** the page's `og:image` is a relative path (e.g., `/assets/preview.png`)
- **THEN** the system resolves it to an absolute URL using the target page's origin before returning it in the response

### Requirement: WebPreviewNode displays OG metadata
The `WebPreviewNode` canvas component SHALL display the fetched OG metadata as a card: favicon + title on top, description below, og:image as a header image if present. Clicking the node SHALL open the URL in a new browser tab.

#### Scenario: Render web preview card
- **WHEN** a `WebPreviewNode` is rendered with OG metadata
- **THEN** the card shows the title, description (truncated to ~2 lines), and og:image if available

#### Scenario: Render web preview without image
- **WHEN** `image` is null in the OG metadata
- **THEN** the card renders without an image section; title and description are shown

#### Scenario: Open link in new tab
- **WHEN** the user clicks (not drags) a `WebPreviewNode`
- **THEN** the node's URL is opened in a new browser tab
