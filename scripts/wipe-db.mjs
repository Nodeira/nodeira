/**
 * Drops and recreates the local nodeira database, then re-applies migrations.
 *
 * Ported from wipe-db.sh because `bash scripts/wipe-db.sh` routes to WSL on Windows, which
 * has no access to the Windows Docker context or to pnpm — the same hazard that
 * scripts/mobile-run.mjs was written in Node to avoid.
 *
 * Requires Docker running with a container named "nodeira-postgres".
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = process.env["NODEIRA_PG_CONTAINER"] ?? "nodeira-postgres";

function psql(sql) {
  return execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-c", sql], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
}

try {
  execFileSync("docker", ["inspect", CONTAINER], { stdio: "ignore" });
} catch {
  console.error(`No container named "${CONTAINER}". Start it with: pnpm run db:up`);
  process.exit(1);
}

console.log("Terminating active connections to nodeira...");
psql(
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity " +
    "WHERE datname = 'nodeira' AND pid <> pg_backend_pid();",
);

console.log("Dropping nodeira database...");
psql("DROP DATABASE IF EXISTS nodeira;");

console.log("Recreating nodeira database...");
psql("CREATE DATABASE nodeira;");

console.log("Applying migrations...");
execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  cwd: path.join(root, "apps/api"),
  stdio: "inherit",
  shell: process.platform === "win32",
});

console.log("Done. nodeira database is clean and up to date.");
