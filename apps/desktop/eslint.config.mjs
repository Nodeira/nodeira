import config from "@nodeira/eslint-config";

/**
 * preload.ts is compiled by its own tsconfig (DOM lib, ESNext modules) and is absent from
 * tsconfig.json's include, so type-aware linting needs both projects listed or it fails
 * with "parserOptions.project has been provided" on that one file.
 */
export default [
  ...config,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.preload.json"],
      },
    },
  },
];
