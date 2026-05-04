import type { QueryClient } from "@tanstack/react-query";
import type { NoteMetadata } from "@nodeira/shared-types";
import type { KindDef } from "./noteKindRegistry.js";

// ── Contribution type definitions ─────────────────────────────────────────────

export interface BrowseViewProps {
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onNavigate: (noteId: string) => void;
}

export interface BrowseViewDef {
  id: string;
  label: string;
  pluginId: string;
  component: React.ComponentType<BrowseViewProps>;
}

export interface PluginPageDef {
  pluginId: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

export interface AsideSectionProps {
  note: NoteMetadata | null;
}

export interface AsideSectionDef {
  id: string;
  pluginId: string;
  component: React.ComponentType<AsideSectionProps>;
}

export interface EditorHeaderProps {
  note: NoteMetadata | null;
}

export interface EditorHeaderDef {
  id: string;
  pluginId: string;
  component: React.ComponentType<EditorHeaderProps>;
}

// ── Plugin manifest ────────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

// ── API surface exposed to plugins ────────────────────────────────────────────

export interface PluginAPI {
  registerBrowseView(def: Omit<BrowseViewDef, "pluginId">): void;
  registerPage(def: Omit<PluginPageDef, "pluginId">): void;
  registerAsideSection(def: Omit<AsideSectionDef, "pluginId">): void;
  registerEditorHeader(def: Omit<EditorHeaderDef, "pluginId">): void;
  registerNoteKind(def: KindDef): void;
  queryClient: QueryClient;
  getCurrentVaultId(): string | null;
}

// ── What a plugin module must export ─────────────────────────────────────────

export interface PluginModule {
  manifest: PluginManifest;
  setup(api: PluginAPI): void | Promise<void>;
}
