import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestPrisma } from "./prisma-test-client.js";
import {
  createTestApp,
  resetDatabase,
  seedApiToken,
  seedUser,
  type SeededUser,
} from "./app-harness.js";

/**
 * Regression coverage for the break that made every `Authorization: Bearer ndra_...`
 * request return 500 across eight modules.
 *
 * JwtAuthGuard injects ApiTokenService, but only AuthModule and RemindersModule made it
 * resolvable. Nest did not fail at boot, because AuthGuard() is a mixin whose constructor
 * parameter carries @Optional() metadata that reflect-metadata inherits onto the subclass —
 * so the dependency quietly became `undefined` and blew up on first use. The Go CLI could
 * not talk to a real server at all.
 *
 * Unit specs could never have caught it: they construct services directly and never build
 * the DI graph, mount the guards, or route a request. These do.
 */
let app: INestApplication;
let prisma: PrismaClient;
let owner: SeededUser;
let apiToken: string;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
  owner = await seedUser(app, prisma);
  apiToken = await seedApiToken(prisma, owner.id);
});

/** Every route group that guards with JwtAuthGuard. */
const GUARDED_ROUTES = [
  "/api/v1/notes",
  "/api/v1/vaults",
  "/api/v1/folders",
  "/api/v1/canvases",
  "/api/v1/plugins",
  "/api/v1/app-state",
  "/api/v1/reminders",
  "/api/v1/devices",
  "/api/v1/users",
];

describe("API token authentication", () => {
  it.each(GUARDED_ROUTES)("accepts an ndra_ token on GET %s", async (route) => {
    const res = await request(app.getHttpServer())
      .get(route)
      .set("Authorization", `Bearer ${apiToken}`);

    // The bug produced 500 here. Anything but a server error means the guard resolved
    // ApiTokenService and authenticated the request.
    expect(res.status).toBeLessThan(500);
    expect(res.status).not.toBe(401);
  });

  it.each(GUARDED_ROUTES)("rejects a bogus ndra_ token on GET %s", async (route) => {
    const res = await request(app.getHttpServer())
      .get(route)
      .set("Authorization", "Bearer ndra_deadbeefdeadbeefdeadbeefdeadbeef");

    expect(res.status).toBe(401);
  });

  it.each(GUARDED_ROUTES)("rejects an unauthenticated GET %s", async (route) => {
    const res = await request(app.getHttpServer()).get(route);
    expect(res.status).toBe(401);
  });

  it("accepts a JWT as well", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/notes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
  });

  it("records lastUsedAt so tokens can be audited", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/notes")
      .set("Authorization", `Bearer ${apiToken}`);

    const record = await prisma.apiToken.findFirst({ where: { userId: owner.id } });
    expect(record?.lastUsedAt).not.toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await seedApiToken(prisma, owner.id);
    await prisma.apiToken.updateMany({
      where: { userId: owner.id, name: "test" },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/notes")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe("API token vault scope", () => {
  it("narrows results to the scoped vault", async () => {
    const second = await prisma.vault.create({
      data: {
        name: "Second",
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    const scoped = await seedApiToken(prisma, owner.id, owner.vaultId);

    await request(app.getHttpServer())
      .post("/api/v1/notes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "In first", vaultId: owner.vaultId })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/notes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "In second", vaultId: second.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/api/v1/notes")
      .set("Authorization", `Bearer ${scoped}`)
      .expect(200);

    expect((res.body as { title: string }[]).map((n) => n.title)).toEqual(["In first"]);
  });

  it("cannot reach a vault outside its scope even though the user can", async () => {
    const second = await prisma.vault.create({
      data: {
        name: "Second",
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    const scoped = await seedApiToken(prisma, owner.id, owner.vaultId);

    // Token scope narrows the user's own access — it never widens it.
    await request(app.getHttpServer())
      .post("/api/v1/notes")
      .set("Authorization", `Bearer ${scoped}`)
      .send({ title: "Sneaky", vaultId: second.id })
      .expect(403);
  });
});
