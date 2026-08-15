import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { randomUUID } from "crypto";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestPrisma } from "./prisma-test-client.js";
import { createTestApp, resetDatabase, seedUser, type SeededUser } from "./app-harness.js";

/**
 * `POST /notes` accepts a client-chosen id so the Android app can create a note offline,
 * open the editor against it immediately, and replay the create when it reconnects.
 *
 * The editor keys its Yjs document by note id, so a server-assigned id would orphan whatever
 * was typed before the note synced. The other half of the contract is idempotency: a queued
 * create whose response was lost gets replayed, and must not produce a second note.
 */
let app: INestApplication;
let prisma: PrismaClient;
let alice: SeededUser;
let bob: SeededUser;

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
  alice = await seedUser(app, prisma);
  bob = await seedUser(app, prisma);
});

const createNote = (user: SeededUser, body: Record<string, unknown>) =>
  request(app.getHttpServer())
    .post("/api/v1/notes")
    .set("Authorization", `Bearer ${user.token}`)
    .send({ vaultId: user.vaultId, ...body });

describe("POST /notes with a client-supplied id", () => {
  it("creates the note under exactly that id", async () => {
    const id = randomUUID();
    const res = await createNote(alice, { id, title: "Written on the train" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(id);

    const stored = await prisma.note.findUnique({ where: { id } });
    expect(stored?.title).toBe("Written on the train");
  });

  it("returns the existing note when the same create is replayed", async () => {
    const id = randomUUID();
    const first = await createNote(alice, { id, title: "Queued once" });
    const second = await createNote(alice, { id, title: "Queued once" });

    expect(first.status).toBe(201);
    expect(second.status).toBeLessThan(300);
    expect(second.body.id).toBe(id);

    expect(await prisma.note.count({ where: { id } })).toBe(1);
  });

  it("does not duplicate when several replays race", async () => {
    const id = randomUUID();
    const results = await Promise.all([
      createNote(alice, { id, title: "Racing" }),
      createNote(alice, { id, title: "Racing" }),
      createNote(alice, { id, title: "Racing" }),
    ]);

    for (const res of results) expect(res.status).toBeLessThan(300);
    expect(await prisma.note.count({ where: { id } })).toBe(1);
  });

  it("keeps the first write's fields — a replay is not an update", async () => {
    const id = randomUUID();
    await createNote(alice, { id, title: "Original" });
    const replay = await createNote(alice, { id, title: "Different title" });

    expect(replay.body.title).toBe("Original");
  });

  it("refuses an id already used by a note the caller cannot reach", async () => {
    const id = randomUUID();
    await createNote(bob, { id, title: "Bob's note" });

    const res = await createNote(alice, { id, title: "Alice trying the same id" });

    // Not found rather than a conflict body: whether that id exists is Bob's business.
    expect(res.status).toBe(404);
    const stored = await prisma.note.findUnique({ where: { id } });
    expect(stored?.title).toBe("Bob's note");
  });

  it("still assigns an id when none is supplied", async () => {
    const res = await createNote(alice, { title: "Server picks" });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it("rejects an id that is not a UUID", async () => {
    const res = await createNote(alice, { id: "not-a-uuid", title: "Nope" });
    expect(res.status).toBe(400);
  });
});
