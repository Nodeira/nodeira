import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import fs from "fs";
import path from "path";

const iconDir = path.join(__dirname, "assets");

// pnpm hoists native deps to the monorepo root; electron-packager only sees
// apps/desktop/node_modules, so we copy any missing native deps into the build.
function findModule(modName: string): string | null {
  let dir = __dirname;
  while (true) {
    const candidate = path.join(dir, "node_modules", modName);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// better-sqlite3 requires 'bindings' and 'file-uri-to-path' at runtime to
// locate its compiled .node file. All three live as siblings in the hoisted
// workspace node_modules and must be copied together.
const NATIVE_DEPS = ["better-sqlite3", "bindings", "file-uri-to-path"];

const config: ForgeConfig = {
  packagerConfig: {
    // Unpack .node files from the asar — Electron cannot dlopen them from
    // inside the archive. Explicit here because the packageAfterCopy hook
    // copies native deps after AutoUnpackNativesPlugin has already scanned.
    asar: { unpack: "**/*.node" },
    name: "Nodeira",
    executableName: "nodeira",
    // Electron Packager chooses .ico on Windows and .icns on macOS when the
    // extension is omitted. Linux reads the PNG from BrowserWindow instead.
    icon: path.join(iconDir, "icon"),
    // Include the built web app so the renderer can load it from file://
    extraResource: ["../../apps/web/dist", "assets"],
  },
  rebuildConfig: {
    // electron-rebuild looks here for native modules in a pnpm workspace
    projectRootPath: path.resolve(__dirname, "../.."),
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      for (const mod of NATIVE_DEPS) {
        const dest = path.join(buildPath, "node_modules", mod);
        if (fs.existsSync(dest)) continue;
        const src = findModule(mod);
        if (!src) throw new Error(`Cannot find native dep '${mod}' in any node_modules`);
        fs.cpSync(src, dest, { recursive: true });
      }
    },
  },
  // NB: the portable .zip for each platform is NOT produced by a maker. @electron-forge/
  // maker-zip delegates to cross-zip, whose Windows branch calls fs.rmdir(recursive) —
  // removed in Node 22, which is what CI runs — so it throws on the one platform we most
  // need it for. scripts/collect-artifacts.mjs builds the archive directly instead.
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "nodeira",
        setupIcon: path.join(iconDir, "icon.ico"),
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          name: "nodeira",
          bin: "nodeira",
          productName: "Nodeira",
          categories: ["Utility"],
          icon: path.join(iconDir, "icon.png"),
        },
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      config: { format: "ULFO", icon: path.join(iconDir, "icon.icns") },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [],
    }),
  ],
};

export default config;
