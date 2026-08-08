import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { authStorage, type StoredUser } from "../lib/authStorage.js";

// ID of the currently open note (null = none)
// Whether the right-side info panel is open
export const asidePanelOpenAtom = atom(false);

// IDs of notes currently open in the tab bar
export const openTabsAtom = atom<string[]>([]);

// Whether the middle views pane is visible
export const viewsPaneOpenAtom = atom(true);

// Selected folder ID for the views pane (null = all notes)
// The currently active vault ID (null until loaded)
export const currentVaultAtom = atom<string | null>(null);

// Persisted widths (px) for the left navbar and right aside; drag handles update these.
export const navbarWidthAtom = atomWithStorage("nodeira:navbar-width", 240);
export const asideWidthAtom = atomWithStorage("nodeira:aside-width", 240);

// Active view in the Browse Pane ("recent" | "pinned" | "kanban" | plugin ids)
export const browsePaneViewAtom = atom<string>("recent");

// Which pane is currently full-screened (null = none)
export const fullscreenPaneAtom = atom<"left" | "browse" | "right" | "editor" | null>(null);

// Currently authenticated user (seeded from localStorage on load)
export const authUserAtom = atom<StoredUser | null>(authStorage.getUser());

// ID of the currently open canvas (null = none)
