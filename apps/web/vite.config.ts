import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // Relative base so built assets load correctly when served via file:// in
  // the Electron desktop app (absolute /assets/... paths break under file://).
  base: "./",
  plugins: [
    // tanstackRouter MUST come before react() — it generates routeTree.gen.ts
    tanstackRouter({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/sync": {
        target: "ws://localhost:3001",
        ws: true,
      },
      "/notifications": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
