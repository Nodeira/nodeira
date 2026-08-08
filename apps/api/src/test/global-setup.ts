import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";
import { resolve } from "path";

const apiDir = resolve(__dirname, "../..");

let container: StartedPostgreSqlContainer;

export async function setup({ provide }: { provide: (key: string, value: string) => void }) {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  // getConnectionUri() hands back `localhost`, which Prisma's engine resolves to ::1.
  // Docker Desktop publishes the mapped port on IPv4 only, so that resolution fails with
  // P1001 while Node's own happy-eyeballs fallback still connects — making the suite look
  // broken on Windows for a reason no TCP probe reveals. Pin to IPv4 explicitly.
  const databaseUrl = container.getConnectionUri().replace("@localhost:", "@127.0.0.1:");

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
