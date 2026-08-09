import { defineConfig } from "vitest/config";

/**
 * apps/web had no vitest config at all, and its test script was
 * `vitest run --passWithNoTests` — a guaranteed green no-op that made "tests pass" mean
 * nothing for the entire frontend.
 *
 * The node environment is deliberate: the tests here cover lifecycle and cache bookkeeping,
 * which needs no DOM. Add jsdom (or happy-dom) when component tests arrive.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
