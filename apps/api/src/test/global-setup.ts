import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";
import { resolve } from "path";

const apiDir = resolve(__dirname, "../..");

let container: StartedPostgreSqlContainer;

export async function setup({ provide }: { provide: (key: string, value: string) => void }) {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = container.getConnectionUri();

  execSync("pnpm exec prisma db push", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}
