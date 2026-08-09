import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

/** How long an issued ticket stays valid. */
export const TICKET_TTL_MS = 60 * 60 * 1000;

export interface IssuedTicket {
  ticket: string;
  /** Epoch milliseconds. The client refreshes before this. */
  expiresAt: number;
}

/**
 * Short-lived, signed credentials for `<img src>` and PDF loads.
 *
 * Attachments are embedded in note documents as plain `/uploads/<uuid>.<ext>` strings, so the
 * browser fetches them without going through the API client — no Authorization header is
 * possible on an `<img>`. A ticket rides in the query string instead.
 *
 * It is deliberately *not* the JWT: it expires in an hour, and it opens exactly one route.
 * Anything that leaks into a proxy log or a Referer header is therefore worth far less than
 * the session token would be.
 *
 * The signing key is derived from JWT_SECRET rather than configured separately — one secret
 * to rotate, and rotating it invalidates tickets and sessions together. The derivation keeps
 * the raw JWT secret out of any value that reaches a client, so a forged-ticket attempt gains
 * nothing usable against the JWT path.
 */
@Injectable()
export class AttachmentTicketService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>("JWT_SECRET");
    this.key = createHmac("sha256", secret).update("nodeira/attachment-ticket/v1").digest();
  }

  issue(userId: string, now = Date.now()): IssuedTicket {
    const expiresAt = now + TICKET_TTL_MS;
    const payload = `${userId}.${expiresAt}`;
    return { ticket: `${b64url(payload)}.${this.sign(payload)}`, expiresAt };
  }

  /** Returns the user id the ticket was issued to, or null if it is invalid or expired. */
  verify(ticket: string, now = Date.now()): string | null {
    const dot = ticket.indexOf(".");
    if (dot <= 0) return null;

    const payload = unB64url(ticket.slice(0, dot));
    if (payload === null) return null;

    // Compare before parsing: an unsigned payload must never reach the expiry or id logic.
    if (!this.matches(payload, ticket.slice(dot + 1))) return null;

    const sep = payload.lastIndexOf(".");
    if (sep <= 0) return null;
    const expiresAt = Number(payload.slice(sep + 1));
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

    return payload.slice(0, sep);
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }

  private matches(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    // timingSafeEqual throws on a length mismatch, which would itself be a (crude) oracle.
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function unB64url(value: string): string | null {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  // base64url decoding never fails, it just produces garbage. Re-encoding is the cheap
  // way to reject input that was not a canonical encoding in the first place.
  return Buffer.from(decoded, "utf8").toString("base64url") === value ? decoded : null;
}
