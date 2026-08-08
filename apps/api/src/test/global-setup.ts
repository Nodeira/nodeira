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

  // migrate deploy, not db push: production applies the committed migration chain, so the
  // suite should exercise the same path. With db push the tests validated schema.prisma
  // while the migrations that actually run in deployments went untested — a migration could
  // be broken or missing entirely and every test would still pass.
  execSync("pnpm exec prisma migrate deploy", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}
