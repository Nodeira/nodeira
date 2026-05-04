import type { PluginAPI, PluginManifest } from "./pluginTypes.js";
import { pluginRegistry } from "./pluginRegistry.js";
import { noteKindRegistry } from "./noteKindRegistry.js";
import { queryClient } from "./queryClient.js";
import { jotaiStore } from "../store/jotaiStore.js";
import { currentVaultAtom } from "../store/atoms.js";

export function createPluginAPI(manifest: PluginManifest): PluginAPI {
  const { id: pluginId } = manifest;

  return {
    registerBrowseView(def) {
      pluginRegistry.registerBrowseView({ ...def, pluginId });
    },
    registerPage(def) {
      pluginRegistry.registerPage({ ...def, pluginId });
    },
    registerAsideSection(def) {
      pluginRegistry.registerAsideSection({ ...def, pluginId });
    },
    registerEditorHeader(def) {
      pluginRegistry.registerEditorHeader({ ...def, pluginId });
    },
    registerNoteKind(def) {
      noteKindRegistry.register(def);
    },
    queryClient,
    getCurrentVaultId() {
      return jotaiStore.get(currentVaultAtom);
    },
  };
}
