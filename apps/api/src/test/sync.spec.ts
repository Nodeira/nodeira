import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import * as Y from "yjs";
import WebSocket from "ws";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestPrisma } from "./prisma-test-client.js";
import { createTestApp, resetDatabase, seedUser, type SeededUser } from "./app-harness.js";

/**
 * The sync path had no tests at all — the ghost-note fix was only covered at the
 * NotesService layer, never through an actual Hocuspocus connection. These drive the real
 * protocol against a real server.
 */
let app: INestApplication;
let prisma: PrismaClient;
let alice: SeededUser;
let bob: SeededUser;
let baseUrl: string;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  app = await createTestApp();
  await app.listen(0);
  const url = await app.getUrl();
  baseUrl = url.replace("http://", "ws://").replace("[::1]", "127.0.0.1") + "/sync";
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

interface ConnectResult {
  status: "authenticated" | "rejected";
  provider: HocuspocusProvider;
  socket: HocuspocusProviderWebsocket;
}

/** Opens a sync connection and resolves once the server has accepted or refused it. */
function connect(noteId: string, token: string, timeoutMs = 6_000): Promise<ConnectResult> {
  return new Promise((resolve) => {
    const socket = new HocuspocusProviderWebsocket({
      url: baseUrl,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
      // Do not let the client paper over a refusal by retrying forever.
      maxAttempts: 1,
    });
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: noteId,
      document: new Y.Doc(),
      token,
      onAuthenticated: () => finish("authenticated"),
      onAuthenticationFailed: () => finish("rejected"),
    });

    let settled = false;
    const finish = (status: ConnectResult["status"]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status, provider, socket });
    };
    // A server that closes the socket without an explicit auth failure also counts as a
    // refusal — that is what an exception thrown in onAuthenticate looks like.
    const timer = setTimeout(() => finish("rejected"), timeoutMs);
  });
}

function teardown(r: ConnectResult) {
  r.provider.destroy();
  r.socket.destroy();
}

async function createNote(vaultId: string, title = "Note") {
  return prisma.note.create({ data: { title, type: "note", vaultId, position: 0 } });
}

describe("sync authentication", () => {
  it("accepts a member of the note's vault", async () => {
    const note = await createNote(alice.vaultId);
    const r = await connect(note.id, alice.token);
    expect(r.status).toBe("authenticated");
    teardown(r);
  });

  it("refuses a connection with no token", async () => {
    const note = await createNote(alice.vaultId);
    const r = await connect(note.id, "");
    expect(r.status).toBe("rejected");
    teardown(r);
  });

  it("refuses a note in a vault the caller cannot reach", async () => {
    const note = await createNote(alice.vaultId);
    const r = await connect(note.id, bob.token);
    expect(r.status).toBe("rejected");
    teardown(r);
  });

  it("refuses a note that does not exist", async () => {
    // Serving a blank document here is worse than refusing: the client syncs, accepts
    // typing, and every flush is silently dropped by updateYjsState's updateMany.
    const r = await connect("00000000-0000-0000-0000-000000000000", alice.token);
    expect(r.status).toBe("rejected");
    teardown(r);
  });

  it("still refuses an unauthorized second connection to an already-open document", async () => {
    // The regression this guards: Hocuspocus caches documents in memory and only calls
    // onLoadDocument on a cache miss. With the check there, Alice's connection warmed the
    // cache and Bob rode in on it. Authorization belongs in onAuthenticate, per connection.
    const note = await createNote(alice.vaultId);

    const first = await connect(note.id, alice.token);
    expect(first.status).toBe("authenticated");

    const second = await connect(note.id, bob.token);
    expect(second.status).toBe("rejected");

    teardown(first);
    teardown(second);
  });

  it("accepts a shared-vault member", async () => {
    const note = await createNote(alice.vaultId);
    await prisma.vaultMember.create({
      data: { vaultId: alice.vaultId, userId: bob.id, role: "VIEWER" },
    });

    const r = await connect(note.id, bob.token);
    expect(r.status).toBe("authenticated");
    teardown(r);
  });
});

describe("sync persistence", () => {
  it("persists edits to the note row", async () => {
    const note = await createNote(alice.vaultId);
    const r = await connect(note.id, alice.token);
    expect(r.status).toBe("authenticated");

    r.provider.document.getXmlFragment("default").insert(0, [new Y.XmlText("hello")]);

    // Let the update reach the server before disconnecting, then give onStoreDocument's
    // debounce time to fire. Tearing down immediately races the write.
    await new Promise((res) => setTimeout(res, 750));
    teardown(r);
    await new Promise((res) => setTimeout(res, 3_000));

    const stored = await prisma.note.findUnique({ where: { id: note.id } });
    expect(stored?.yjsState).not.toBeNull();
  });

  it("does not resurrect a note deleted while a connection was open", async () => {
    const note = await createNote(alice.vaultId);
    const r = await connect(note.id, alice.token);
    expect(r.status).toBe("authenticated");

    await prisma.note.delete({ where: { id: note.id } });

    r.provider.document.getXmlFragment("default").insert(0, [new Y.XmlText("ghost")]);
    await new Promise((res) => setTimeout(res, 750));
    teardown(r);
    await new Promise((res) => setTimeout(res, 3_000));
    // updateYjsState uses updateMany, so the flush affects zero rows instead of recreating
    // the note as an orphan with no vault.
    expect(await prisma.note.findUnique({ where: { id: note.id } })).toBeNull();
  });
});
