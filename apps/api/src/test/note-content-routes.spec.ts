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
 * `PUT /notes/:id/content` reaches the live Yjs document through `DocumentBridge`, which
 * opens a Hocuspocus *direct* connection. A direct connection has no socket and no token, so
 * `onAuthenticate` never runs — and the bridge was not supplying a context in its place, so
 * `onLoadDocument` destructured `{ user }` off `undefined` and threw. The route 500'd.
 *
 * Only on a cache miss, though: Hocuspocus calls `onLoadDocument` once per document and then
 * serves it from memory. Any note a browser already had open worked fine, which is how this
 * survived — and why these tests are careful to write to notes nothing has ever opened. It is
 * the CLI's entire write path.
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

/** Creates a note through the API and never opens it, so its document is not cached. */
async function coldNote(owner: SeededUser, title = "Cold note"): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/v1/notes")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ title, vaultId: owner.vaultId });

  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe("PUT /notes/:id/content", () => {
  it("writes to a note no one has ever opened", async () => {
    const id = await coldNote(alice);

    const res = await request(app.getHttpServer())
      .put(`/api/v1/notes/${id}/content`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "# Hello\n\nFrom a cold document.\n" });

    // This was 500 — "Cannot destructure property 'user' of 'context' as it is undefined".
    expect(res.status).toBeLessThan(400);
  });

  it("round-trips the content back out", async () => {
    const id = await coldNote(alice);

    await request(app.getHttpServer())
      .put(`/api/v1/notes/${id}/content`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "# Title\n\nBody text.\n" })
      .expect((r) => expect(r.status).toBeLessThan(400));

    const res = await request(app.getHttpServer())
      .get(`/api/v1/notes/${id}/content`)
      .set("Authorization", `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Title");
    expect(res.body.content).toContain("Body text.");
  });

  it("works for an API token — the CLI's write path", async () => {
    const id = await coldNote(alice);
    const apiToken = await seedApiToken(prisma, alice.id);

    const res = await request(app.getHttpServer())
      .put(`/api/v1/notes/${id}/content`)
      .set("Authorization", `Bearer ${apiToken}`)
      .send({ content: "Written by the CLI.\n" });

    expect(res.status).toBeLessThan(400);
  });

  it("accepts a second write to the same note", async () => {
    const id = await coldNote(alice);
    const put = (content: string) =>
      request(app.getHttpServer())
        .put(`/api/v1/notes/${id}/content`)
        .set("Authorization", `Bearer ${alice.token}`)
        .send({ content });

    expect((await put("First.\n")).status).toBeLessThan(400);
    expect((await put("Second.\n")).status).toBeLessThan(400);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/notes/${id}/content`)
      .set("Authorization", `Bearer ${alice.token}`);

    expect(res.body.content).toContain("Second.");
    expect(res.body.content).not.toContain("First.");
  });

  it("refuses a note in a vault the caller is not a member of", async () => {
    const id = await coldNote(alice);

    const res = await request(app.getHttpServer())
      .put(`/api/v1/notes/${id}/content`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "Not mine.\n" });

    // NotFound rather than Forbidden — whether the note exists is itself information.
    expect(res.status).toBe(404);
  });

  it("refuses an unauthenticated write", async () => {
    const id = await coldNote(alice);

    const res = await request(app.getHttpServer())
      .put(`/api/v1/notes/${id}/content`)
      .send({ content: "Anonymous.\n" });

    expect(res.status).toBe(401);
  });
});
