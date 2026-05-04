import { atom } from "jotai";
import type {
  BrowseViewDef,
  PluginPageDef,
  AsideSectionDef,
  EditorHeaderDef,
} from "./pluginTypes.js";

// Version counter — increment to trigger re-renders in subscribing components.
// Components call useAtomValue(pluginRegistryVersionAtom) to subscribe.
export const pluginRegistryVersionAtom = atom(0);

class PluginRegistry {
  private browseViews = new Map<string, BrowseViewDef>();
  private pages = new Map<string, PluginPageDef>();
  private asideSections = new Map<string, AsideSectionDef>();
  private editorHeaders = new Map<string, EditorHeaderDef>();
  private notifyFn: (() => void) | null = null;

  setNotifier(fn: () => void) {
    this.notifyFn = fn;
  }

  private notify() {
    this.notifyFn?.();
  }

  registerBrowseView(def: BrowseViewDef) {
    this.browseViews.set(def.id, def);
    this.notify();
  }

  registerPage(def: PluginPageDef) {
    this.pages.set(def.pluginId, def);
    this.notify();
  }

  registerAsideSection(def: AsideSectionDef) {
    this.asideSections.set(def.id, def);
    this.notify();
  }

  registerEditorHeader(def: EditorHeaderDef) {
    this.editorHeaders.set(def.id, def);
    this.notify();
  }

  getBrowseViews(): BrowseViewDef[] {
    return Array.from(this.browseViews.values());
  }

  getPages(): PluginPageDef[] {
    return Array.from(this.pages.values());
  }

  getAsideSections(): AsideSectionDef[] {
    return Array.from(this.asideSections.values());
  }

  getEditorHeaders(): EditorHeaderDef[] {
    return Array.from(this.editorHeaders.values());
  }
}

export const pluginRegistry = new PluginRegistry();
