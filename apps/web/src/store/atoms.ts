import { atom } from "jotai";
import { authStorage, type StoredUser } from "../lib/authStorage.js";

// ID of the currently open note (null = none)
export const activeNoteIdAtom = atom<string | null>(null);

// Whether the right-side info panel is open
export const asidePanelOpenAtom = atom(false);

// IDs of notes currently open in the tab bar
export const openTabsAtom = atom<string[]>([]);

// Whether the middle views pane is visible
export const viewsPaneOpenAtom = atom(true);

// Selected folder ID for the views pane (null = all notes)
export const viewsFolderAtom = atom<string | null>(null);

// The currently active vault ID (null until loaded)
export const currentVaultAtom = atom<string | null>(null);

// Active view in the Browse Pane ("recent" | "pinned" | "kanban" | plugin ids)
export const browsePaneViewAtom = atom<string>("recent");

// Which pane is currently full-screened (null = none)
export const fullscreenPaneAtom = atom<"left" | "browse" | "right" | "editor" | null>(null);

// Currently authenticated user (seeded from localStorage on load)
export const authUserAtom = atom<StoredUser | null>(authStorage.getUser());
