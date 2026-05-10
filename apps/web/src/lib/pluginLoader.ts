import { pluginRegistry, pluginRegistryVersionAtom } from "./pluginRegistry.js";
import { createPluginAPI } from "./pluginApi.js";
import { jotaiStore } from "../store/jotaiStore.js";
import type { PluginModule } from "./pluginTypes.js";
import "./electronAPI.js";

// ── CDN URL construction ───────────────────────────────────────────────────────

// "owner/repo@v1.0.0" → "https://cdn.jsdelivr.net/gh/owner/repo@v1.0.0/dist/index.js"
export function buildCdnUrl(source: string): string {
  const atIdx = source.lastIndexOf("@");
  if (atIdx <= 0) {
    throw new Error(`Invalid plugin source: "${source}". Expected "owner/repo@version".`);
  }
  const repoPath = source.slice(0, atIdx);
  const version = source.slice(atIdx + 1);
  return `https://cdn.jsdelivr.net/gh/${repoPath}@${version}/dist/index.js`;
}

// ── Dev-mode local registry ────────────────────────────────────────────────────

const devPluginModules = new Map<string, () => Promise<PluginModule>>();

export function registerDevPlugin(pluginId: string, loader: () => Promise<PluginModule>) {
  devPluginModules.set(pluginId, loader);
}

// ── Load a single plugin ───────────────────────────────────────────────────────

const loadedSources = new Set<string>();

export async function loadPlugin(source: string): Promise<void> {
  if (loadedSources.has(source)) return;

  let pluginModule: PluginModule;

  try {
    if (source.startsWith("dev:")) {
      const pluginId = source.slice(4);
      const loader = devPluginModules.get(pluginId);
      if (!loader) throw new Error(`No dev plugin registered for id "${pluginId}"`);
      pluginModule = await loader();
    } else {
      const devLoader = import.meta.env.DEV
        ? devPluginModules.get(source.slice(0, source.lastIndexOf("@")))
        : undefined;
      if (devLoader) {
        pluginModule = await devLoader();
      } else {
        pluginModule = await loadFromCdnWithCache(source);
      }
    }

    const api = createPluginAPI(pluginModule.manifest);
    await pluginModule.setup(api);
    loadedSources.add(source);
  } catch (err) {
    console.error(`[Nodeira] Failed to load plugin "${source}":`, err);
  }
}

async function loadFromCdnWithCache(source: string): Promise<PluginModule> {
  const desktopPlugin = window.electronAPI?.plugin;
  const url = buildCdnUrl(source);

  // Try CDN first
  try {
    const mod = (await import(/* @vite-ignore */ url)) as PluginModule;
    // Cache the bundle text for offline use (best-effort — don't block load on failure)
    if (desktopPlugin) {
      fetch(url)
        .then((r) => r.text())
        .then((bundle) => desktopPlugin.setCachedBundle(source, bundle))
        .catch(() => undefined);
    }
    return mod;
  } catch (cdnErr) {
    // CDN failed — try SQLite cache if running in Electron
    if (desktopPlugin) {
      const cached = await desktopPlugin.getCachedBundle(source);
      if (cached) {
        const blob = new Blob([cached], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        try {
          return (await import(/* @vite-ignore */ blobUrl)) as PluginModule;
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    }
    throw cdnErr;
  }
}

// ── Load all enabled plugins ───────────────────────────────────────────────────

export async function loadAllPlugins(sources: string[]): Promise<void> {
  const notify = () => jotaiStore.set(pluginRegistryVersionAtom, (v) => v + 1);
  pluginRegistry.setNotifier(notify);

  await Promise.allSettled(sources.map(loadPlugin));

  // Always notify after loading so StrictMode remounts re-subscribe correctly.
  notify();
}
