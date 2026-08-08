import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { inject } from "vitest";
import { JwtService } from "@nestjs/jwt";
import type { PrismaClient } from "@prisma/client";
import { Role, VaultRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppModule } from "../app.module.js";
import { SyncWsAdapter } from "../sync/sync-ws-adapter.js";
import { cleanDatabase } from "./prisma-test-client.js";

/**
 * Boots the real application over HTTP for controller-level tests.
 *
 * Every existing spec builds services by hand (`new NotesService(...)`). That is why the
 * JwtAuthGuard/ApiTokenService break — which made every `Bearer ndra_` request 500 across
 * eight modules — was invisible to a green suite: nothing ever exercised the DI graph, the
 * guards, the validation pipe or the route table.
 *
 * Mirrors main.ts's bootstrap so that prefix, versioning and validation behave identically.
 */
export async function createTestApp(): Promise<INestApplication> {
  // PrismaService reads DATABASE_URL in its constructor. Without this the application
  // connects to whatever apps/api/.env points at — the developer's dev database — while
  // the test client talks to the container, so every seeded user is invisible and every
  // request comes back 401.
  process.env["DATABASE_URL"] = inject("databaseUrl");
  process.env["JWT_SECRET"] ??= "test-secret-that-is-long-enough-for-validation";

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  // SyncModule registers a gateway, so an adapter must be set before init() or Nest tries
  // to load socket.io and calls process.exit(1). Using the real one keeps the harness
  // faithful to main.ts.
  app.useWebSocketAdapter(new SyncWsAdapter(app));

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();
  return app;
}

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  token: string;
  vaultId: string;
}

/** Signs a JWT the same way AuthService does, without going through the login route. */
function signToken(app: INestApplication, user: { id: string; email: string; role: Role }): string {
  return app.get(JwtService).sign({ sub: user.id, email: user.email, role: user.role });
}

/** Creates a user, their vault, and a ready-to-use bearer token. */
export async function seedUser(
  app: INestApplication,
  prisma: PrismaClient,
  opts: { email?: string; role?: Role } = {},
): Promise<SeededUser> {
  const email = opts.email ?? `user-${randomBytes(4).toString("hex")}@example.com`;
  const password = "password123";

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 4),
      role: opts.role ?? Role.ADMIN,
    },
  });
  const vault = await prisma.vault.create({
    data: {
      name: "Main vault",
      ownerId: user.id,
      members: { create: { userId: user.id, role: VaultRole.OWNER } },
    },
  });

  return {
    id: user.id,
    email,
    password,
    token: signToken(app, { id: user.id, email, role: user.role }),
    vaultId: vault.id,
  };
}

/** Issues a real API token for a user, returning the raw `ndra_` value. */
export async function seedApiToken(
  prisma: PrismaClient,
  userId: string,
  vaultId?: string | null,
): Promise<string> {
  const raw = `ndra_${randomBytes(32).toString("hex")}`;
  await prisma.apiToken.create({
    data: {
      name: "test",
      // Must match ApiTokenService.hash exactly, or validateToken silently misses.
      tokenHash: createHash("sha256").update(raw).digest("hex"),
      userId,
      vaultId: vaultId ?? null,
    },
  });
  return raw;
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await cleanDatabase(prisma);
}
