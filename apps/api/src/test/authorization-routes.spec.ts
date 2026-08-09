import type { INestApplication } from "@nestjs/common";
import { Role, VaultRole, type PrismaClient } from "@prisma/client";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestPrisma } from "./prisma-test-client.js";
import { createTestApp, resetDatabase, seedUser, type SeededUser } from "./app-harness.js";

/**
 * Authorization behaviour as a client actually experiences it.
 *
 * Service-level specs cover VaultAccessService directly; these check that the guards,
 * decorators and controllers are wired such that the rules survive the round trip.
 */
let app: INestApplication;
let prisma: PrismaClient;
let alice: SeededUser;
let bob: SeededUser;

const auth = (u: SeededUser) => ({ Authorization: `Bearer ${u.token}` });

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
  alice = await seedUser(app, prisma, { role: Role.ADMIN });
  bob = await seedUser(app, prisma, { role: Role.USER });
});

async function createNote(user: SeededUser, title: string, vaultId = user.vaultId) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/notes")
    .set(auth(user))
    .send({ title, vaultId })
    .expect(201);
  return res.body as { id: string; title: string };
}

describe("vault isolation over HTTP", () => {
  it("does not leak another user's notes into the list", async () => {
    await createNote(alice, "Alice secret");
    const res = await request(app.getHttpServer()).get("/api/v1/notes").set(auth(bob)).expect(200);
    expect(res.body).toEqual([]);
  });

  it("returns 404, not 403, for a note in another user's vault", async () => {
    const note = await createNote(alice, "Alice secret");
    // 404 deliberately: whether that note exists is itself information.
    await request(app.getHttpServer()).get(`/api/v1/notes/${note.id}`).set(auth(bob)).expect(404);
  });

  it("refuses writes into another user's vault", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/notes")
      .set(auth(bob))
      .send({ title: "Sneaky", vaultId: alice.vaultId })
      .expect(404);
  });

  it("refuses deletion of another user's note", async () => {
    const note = await createNote(alice, "Alice secret");
    await request(app.getHttpServer())
      .delete(`/api/v1/notes/${note.id}`)
      .set(auth(bob))
      .expect(404);
    expect(await prisma.note.findUnique({ where: { id: note.id } })).not.toBeNull();
  });

  it("keeps folders and canvases isolated too", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/folders")
      .set(auth(alice))
      .send({ name: "Alice folder", vaultId: alice.vaultId })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/canvases")
      .set(auth(alice))
      .send({ title: "Alice canvas", vaultId: alice.vaultId })
      .expect(201);

    expect((await request(app.getHttpServer()).get("/api/v1/folders").set(auth(bob))).body).toEqual(
      [],
    );
    expect(
      (await request(app.getHttpServer()).get("/api/v1/canvases").set(auth(bob))).body,
    ).toEqual([]);
  });
});

describe("vault sharing over HTTP", () => {
  it("grants read after sharing, and still refuses writes to a VIEWER", async () => {
    const note = await createNote(alice, "Shared");

    await request(app.getHttpServer())
      .post(`/api/v1/vaults/${alice.vaultId}/members`)
      .set(auth(alice))
      .send({ userId: bob.id, role: VaultRole.VIEWER })
      .expect(201);

    await request(app.getHttpServer()).get(`/api/v1/notes/${note.id}`).set(auth(bob)).expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set(auth(bob))
      .send({ title: "hacked" })
      .expect(403);
  });

  it("lets an EDITOR write but not re-share", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/vaults/${alice.vaultId}/members`)
      .set(auth(alice))
      .send({ userId: bob.id, role: VaultRole.EDITOR })
      .expect(201);

    await createNote(bob, "Bob writes here", alice.vaultId);

    const carol = await seedUser(app, prisma, { role: Role.USER });
    await request(app.getHttpServer())
      .post(`/api/v1/vaults/${alice.vaultId}/members`)
      .set(auth(bob))
      .send({ userId: carol.id, role: VaultRole.VIEWER })
      .expect(403);
  });

  it("revokes access when membership is removed", async () => {
    const note = await createNote(alice, "Shared");
    await request(app.getHttpServer())
      .post(`/api/v1/vaults/${alice.vaultId}/members`)
      .set(auth(alice))
      .send({ userId: bob.id, role: VaultRole.VIEWER })
      .expect(201);
    await request(app.getHttpServer()).get(`/api/v1/notes/${note.id}`).set(auth(bob)).expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/vaults/${alice.vaultId}/members/${bob.id}`)
      .set(auth(alice))
      // 204, not 200: there is nothing to return, and a 200 with an empty body made the
      // web client's res.json() throw — the revoke worked server-side while the UI
      // reported failure and never refreshed its member list.
      .expect(204);

    await request(app.getHttpServer()).get(`/api/v1/notes/${note.id}`).set(auth(bob)).expect(404);
  });
});

describe("instance roles", () => {
  it("lets an admin create a user, defaulting them to USER", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set(auth(alice))
      .send({ email: "new@example.com", password: "password123" })
      .expect(201);
    expect((res.body as { role: string }).role).toBe(Role.USER);
  });

  it("refuses user creation by a non-admin", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/users")
      .set(auth(bob))
      .send({ email: "eve@example.com", password: "password123" })
      .expect(403);
  });

  it("gives each user their own app-state", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/app-state")
      .set(auth(alice))
      .send({ openTabs: ["a"] })
      .expect(204);

    const forBob = await request(app.getHttpServer())
      .get("/api/v1/app-state")
      .set(auth(bob))
      .expect(200);
    // Previously one global row: Alice's tabs would have appeared here.
    expect((forBob.body as { openTabs: string[] }).openTabs).toEqual([]);
  });
});

describe("input validation", () => {
  it("rejects a note with no vault", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/notes")
      .set(auth(alice))
      .send({ title: "Homeless" })
      .expect(400);
  });

  it("rejects unknown properties", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/notes")
      .set(auth(alice))
      .send({ title: "x", vaultId: alice.vaultId, notAField: true })
      .expect(400);
  });

  it("rejects tags on update, since the document owns them", async () => {
    const note = await createNote(alice, "Tagged");
    await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set(auth(alice))
      .send({ tags: ["manual"] })
      .expect(400);
  });
});
