import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestPrisma } from "./prisma-test-client.js";
import {
  createTestApp,
  resetDatabase,
  seedApiToken,
  seedUser,
  type SeededUser,
} from "./app-harness.js";
import {
  AttachmentTicketService,
  TICKET_TTL_MS,
} from "../attachments/attachment-ticket.service.js";
import { uploadsDir } from "../attachments/uploads-dir.js";

/**
 * Attachments were served by `app.useStaticAssets(uploadsDir, { prefix: "/uploads" })` — every
 * uploaded image and PDF fetchable by anyone who knew or guessed the URL, with the UUID in the
 * filename as the only barrier. These pin the replacement: the route authenticates, and it
 * does so for the `<img>`-shaped request (a ticket in the query string) as well as the
 * API-client-shaped one (a bearer token in a header).
 */
let app: INestApplication;
let prisma: PrismaClient;
let user: SeededUser;
let tickets: AttachmentTicketService;
let filename: string;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  app = await createTestApp();
  tickets = app.get(AttachmentTicketService);

  filename = `${randomUUID()}.png`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(join(uploadsDir(), filename), PNG);
});

afterAll(async () => {
  await rm(join(uploadsDir(), filename), { force: true });
  await app?.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
  user = await seedUser(app, prisma);
});

const url = (name = filename) => `/api/v1/attachments/${name}`;

describe("attachment ticket", () => {
  it("is refused without credentials", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/attachments/ticket");
    expect(res.status).toBe(401);
  });

  it("is issued to an authenticated user with an expiry", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/attachments/ticket")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.ticket).toBe("string");
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());
    expect(res.body.expiresAt).toBeLessThanOrEqual(Date.now() + TICKET_TTL_MS);
  });

  it("is issued for an API token too", async () => {
    const apiToken = await seedApiToken(prisma, user.id);
    const res = await request(app.getHttpServer())
      .get("/api/v1/attachments/ticket")
      .set("Authorization", `Bearer ${apiToken}`);

    expect(res.status).toBe(200);
  });
});

describe("attachment fetch", () => {
  it("refuses an anonymous request — the whole point of the change", async () => {
    const res = await request(app.getHttpServer()).get(url());
    expect(res.status).toBe(401);
  });

  it("serves the file for a valid ticket", async () => {
    const { ticket } = tickets.issue(user.id);
    const res = await request(app.getHttpServer()).get(`${url()}?t=${encodeURIComponent(ticket)}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toContain("private");
    expect(Buffer.from(res.body as Buffer).equals(PNG)).toBe(true);
  });

  it("serves the file for a bearer token", async () => {
    const res = await request(app.getHttpServer())
      .get(url())
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
  });

  it("refuses a forged ticket", async () => {
    const { ticket } = tickets.issue(user.id);
    const res = await request(app.getHttpServer()).get(`${url()}?t=${ticket.slice(0, -2)}xy`);
    expect(res.status).toBe(401);
  });

  it("refuses an expired ticket", async () => {
    const { ticket } = tickets.issue(user.id, Date.now() - TICKET_TTL_MS - 1);
    const res = await request(app.getHttpServer()).get(`${url()}?t=${encodeURIComponent(ticket)}`);
    expect(res.status).toBe(401);
  });

  it("refuses to walk out of the uploads directory", async () => {
    const { ticket } = tickets.issue(user.id);
    // %2f keeps this a single path segment for the router, so the traversal reaches the
    // handler as a decoded `../` param rather than being routed away.
    const res = await request(app.getHttpServer()).get(
      `/api/v1/attachments/..%2f..%2fpackage.json?t=${encodeURIComponent(ticket)}`,
    );
    expect(res.status).toBe(404);
  });

  it("404s a well-formed name with no file behind it", async () => {
    const { ticket } = tickets.issue(user.id);
    const res = await request(app.getHttpServer()).get(
      `${url(`${randomUUID()}.png`)}?t=${encodeURIComponent(ticket)}`,
    );
    expect(res.status).toBe(404);
  });

  it("no longer answers on the old unauthenticated /uploads path", async () => {
    // Partial cover only: the static mount lived in main.ts, which this harness does not run.
    // It does catch the mount being reintroduced through app.module.ts's ServeStaticModule.
    const res = await request(app.getHttpServer()).get(`/uploads/${filename}`);
    expect(res.status).toBe(404);
  });
});
