// Curated icon set for the icon picker, organized by category.
// Icon names are kebab-case Tabler icon names (e.g. "file-text" → IconFileText).

export interface IconCategory {
  label: string;
  icons: string[];
}

export const ICON_CATEGORIES: IconCategory[] = [
  {
    label: "Files & Notes",
    icons: [
      "file", "file-text", "file-description", "file-code", "file-spreadsheet",
      "file-zip", "file-cv", "notes", "notebook", "notebook-off",
      "book", "book-2", "book-open", "books", "bookmarks",
      "clipboard", "clipboard-list", "clipboard-check", "clipboard-text",
      "writing", "pencil", "pen", "signature", "eraser", "markdown",
    ],
  },
  {
    label: "Folders & Organization",
    icons: [
      "folder", "folder-open", "folder-filled", "folder-star", "folder-heart",
      "folders", "inbox", "archive", "box", "package",
      "tag", "tags", "hash", "bookmark", "bookmarks",
      "list", "list-check", "layout-list", "layout-kanban", "table",
      "stack", "stack-2", "stack-3", "layers", "layer-difference",
    ],
  },
  {
    label: "Work & Projects",
    icons: [
      "briefcase", "building", "building-skyscraper", "building-factory",
      "chart-bar", "chart-line", "chart-pie", "chart-dots",
      "rocket", "rocket-off", "target", "focus-2",
      "calendar", "calendar-event", "calendar-check", "clock",
      "mail", "mail-opened", "phone", "message", "messages",
      "link", "external-link", "world", "globe",
    ],
  },
  {
    label: "Development",
    icons: [
      "code", "code-circle", "terminal", "terminal-2",
      "bug", "bug-off", "braces", "curly-loop",
      "database", "server", "cloud", "server-2",
      "cpu", "circuit-board", "chip", "binary",
      "git-branch", "git-commit", "git-merge", "git-pull-request",
      "api", "webhook", "variable", "lambda",
    ],
  },
  {
    label: "Study & Learning",
    icons: [
      "school", "certificate", "award", "medal",
      "math-function", "math", "sum",
      "flask", "flask-2", "atom", "atom-2", "microscope",
      "compass", "ruler", "ruler-2", "calculator",
      "abacus", "brain", "bulb", "question-mark",
      "alphabet-latin", "language", "abc",
    ],
  },
  {
    label: "Creative",
    icons: [
      "palette", "brush", "paint", "photo", "camera",
      "movie", "film", "microphone", "music",
      "headphones", "piano", "guitar",
      "feather", "vector", "shapes", "artboard",
      "wand", "sparkles", "stars", "confetti",
      "scissors", "layout", "template", "components",
    ],
  },
  {
    label: "Personal & Life",
    icons: [
      "home", "home-2", "building-community",
      "user", "users", "user-circle", "friends",
      "heart", "heart-filled", "star", "star-filled",
      "coffee", "tea", "pizza", "salad",
      "car", "plane", "train", "ship",
      "gift", "shopping-bag", "shopping-cart",
      "beach", "mountain", "tent", "garden-cart",
    ],
  },
  {
    label: "Health & Nature",
    icons: [
      "leaf", "plant", "tree", "plant-2",
      "sun", "moon", "cloud", "cloud-rain", "snowflake",
      "flame", "droplet", "wind",
      "heart-rate", "activity", "run", "yoga",
      "apple", "salad", "pill", "stethoscope",
    ],
  },
  {
    label: "Finance",
    icons: [
      "coin", "coins", "wallet", "currency-dollar", "currency-euro",
      "credit-card", "receipt", "receipt-2",
      "trending-up", "trending-down", "pig-money",
      "report", "report-money", "cash", "transfer",
      "percentage", "discount",
    ],
  },
  {
    label: "Security & Settings",
    icons: [
      "lock", "lock-open", "key", "shield", "shield-check",
      "fingerprint", "eye", "eye-off",
      "settings", "settings-2", "adjustments", "tool",
      "wrench", "hammer", "screwdriver",
      "trash", "archive", "refresh", "reload",
    ],
  },
];

export const ALL_ICONS: string[] = ICON_CATEGORIES.flatMap((c) => c.icons);

// Convert kebab-case icon name to the Tabler PascalCase component name.
// e.g. "file-text" → "IconFileText"
export function toTablerName(kebab: string): string {
  return (
    "Icon" +
    kebab
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("")
  );
}
