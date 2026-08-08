import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  // Vitest transforms TypeScript with esbuild, which cannot emit decorator metadata.
  // Without `design:paramtypes`, Nest resolves every constructor parameter to undefined,
  // so nothing can be tested through the DI container — which is exactly how the
  // JwtAuthGuard/ApiTokenService break stayed invisible. SWC preserves the metadata.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    globals: true,
    setupFiles: ["reflect-metadata"],
    globalSetup: ["./src/test/global-setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
