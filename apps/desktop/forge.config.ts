import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Nodeira",
    executableName: "nodeira",
    // Include the built web app so the renderer can load it from file://
    extraResource: ["../../apps/web/dist"],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: { name: "nodeira" },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          name: "nodeira",
          bin: "nodeira",
          productName: "Nodeira",
          categories: ["Utility"],
        },
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      config: { format: "ULFO" },
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
