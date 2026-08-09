import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, it, expect, beforeEach } from "vitest";
import { AttachmentTicketService, TICKET_TTL_MS } from "./attachment-ticket.service.js";

/**
 * The ticket is the whole of the attachment route's authentication, so these cover the ways
 * a forged one could be made to pass: a rewritten payload, a lifted signature, an expiry the
 * signature does not cover, and a non-canonical encoding of an otherwise valid payload.
 */
async function build(secret: string): Promise<AttachmentTicketService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AttachmentTicketService,
      { provide: ConfigService, useValue: { getOrThrow: () => secret } },
    ],
  }).compile();
  return moduleRef.get(AttachmentTicketService);
}

const SECRET = "test-secret-that-is-long-enough-for-validation";

let service: AttachmentTicketService;

beforeEach(async () => {
  service = await build(SECRET);
});

describe("AttachmentTicketService", () => {
  it("round-trips the user id it was issued to", () => {
    const { ticket } = service.issue("user-1");
    expect(service.verify(ticket)).toBe("user-1");
  });

  it("reports an expiry one TTL out", () => {
    const now = 1_700_000_000_000;
    expect(service.issue("user-1", now).expiresAt).toBe(now + TICKET_TTL_MS);
  });

  it("rejects a ticket past its expiry", () => {
    const now = Date.now();
    const { ticket } = service.issue("user-1", now - TICKET_TTL_MS - 1);
    expect(service.verify(ticket, now)).toBeNull();
  });

  it("rejects a ticket signed with a different secret", async () => {
    const other = await build("a-completely-different-secret-of-length");
    const { ticket } = other.issue("user-1");
    expect(service.verify(ticket)).toBeNull();
  });

  it("rejects a payload edited to name another user", () => {
    const { ticket } = service.issue("user-1");
    const [, signature] = ticket.split(".");
    const forged = `${Buffer.from(`user-2.${Date.now() + TICKET_TTL_MS}`).toString("base64url")}.${signature}`;
    expect(service.verify(forged)).toBeNull();
  });

  it("rejects a payload edited to extend the expiry", () => {
    const now = Date.now();
    const { ticket } = service.issue("user-1", now - TICKET_TTL_MS - 1);
    const [, signature] = ticket.split(".");
    const forged = `${Buffer.from(`user-1.${now + TICKET_TTL_MS}`).toString("base64url")}.${signature}`;
    expect(service.verify(forged, now)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const { ticket } = service.issue("user-1");
    expect(service.verify(`${ticket}x`)).toBeNull();
  });

  it("rejects a non-canonical encoding of a valid payload", () => {
    // Padded base64 decodes to the same bytes as the base64url form the signature covers.
    // Without the canonical-form check this is a second valid representation of one ticket.
    const [payload, signature] = service.issue("user-1").ticket.split(".");
    expect(service.verify(`${payload}==.${signature}`)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", ".", "nodots", ".onlysig", "a.b.c"]) {
      expect(service.verify(bad)).toBeNull();
    }
  });
});
