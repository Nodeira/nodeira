import { UnprocessableEntityException } from "@nestjs/common";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import dns from "node:dns";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 5_000;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * True for any address that is not safe to fetch from a server.
 *
 * The previous version compared string prefixes ("127.", "10.", …), which missed
 * 0.0.0.0 (routes to localhost on Linux), IPv4-mapped IPv6 (::ffff:127.0.0.1), the
 * carrier-grade NAT range, and anything written in decimal or octal form — all of which
 * `new URL()` and the OS resolver happily accept. Parsing numerically closes that.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return true;
    // IPv4-mapped — unwrap and re-check as IPv4.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return false;
  }

  if (version !== 4) return true; // not an IP literal — caller resolves first

  const parts = address.split(".").map(Number);
  const [a, b] = parts as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8 — 0.0.0.0 reaches localhost on Linux
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 protocol assignments
  if (a >= 224) return true; // multicast and reserved
  return false;
}

function assertUrlShape(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnprocessableEntityException("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnprocessableEntityException("Only http and https URLs are allowed");
  }

  // A literal IP never reaches the guarded lookup — Node skips DNS resolution entirely for
  // one — so http://169.254.169.254/ would otherwise be connected to directly. URL wraps
  // IPv6 literals in brackets, hence the strip.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) {
    throw new UnprocessableEntityException("URLs to private networks are not allowed");
  }

  return parsed;
}

/**
 * A DNS lookup that refuses to hand back a private address.
 *
 * Validating before the request and then letting the agent resolve again is a
 * time-of-check/time-of-use hole: a hostname can return a public address to the check and
 * a private one microseconds later (DNS rebinding). Hooking the lookup the socket actually
 * uses means the address that gets connected to is the address that was validated.
 */
const guardedLookup: LookupFunction = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
): void => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");

    const list = addresses as LookupAddress[];
    const safe = list.filter((entry) => !isPrivateAddress(entry.address));
    // Every address must be safe. Accepting the request when only some are lets a host
    // with both a public and a private record through on a retry.
    if (safe.length !== list.length || safe.length === 0) {
      return callback(
        Object.assign(new Error("Resolved to a private address"), { code: "EACCES" }),
        "",
      );
    }

    if (options.all) return callback(null, safe);
    const first = safe[0]!;
    callback(null, first.address, first.family);
  });
};

interface FetchResult {
  html: string;
  finalUrl: string;
}

function requestOnce(url: URL): Promise<{ status: number; location?: string; body?: string }> {
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        timeout: TIMEOUT_MS,
        lookup: guardedLookup,
        headers: {
          "User-Agent": "Nodeira link preview (+https://github.com/Nodeira/nodeira)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;

        // Redirects are followed by hand so each hop is validated. Node's own redirect
        // following (and fetch's) would happily walk to http://169.254.169.254/ because
        // only the first URL was ever checked.
        if (status >= 300 && status < 400 && location) {
          res.resume();
          return resolve({ status, location });
        }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );

    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** Fetches HTML for link previews, refusing anything that reaches a private network. */
export async function safeFetchHtml(rawUrl: string): Promise<FetchResult> {
  let current = assertUrlShape(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let result;
    try {
      result = await requestOnce(current);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EACCES") {
        throw new UnprocessableEntityException("URLs to private networks are not allowed");
      }
      throw new UnprocessableEntityException("Could not fetch URL");
    }

    if (result.location) {
      current = assertUrlShape(new URL(result.location, current).toString());
      continue;
    }

    if (result.status < 200 || result.status >= 300) {
      throw new UnprocessableEntityException("Could not fetch URL");
    }
    return { html: result.body ?? "", finalUrl: current.toString() };
  }

  throw new UnprocessableEntityException("Too many redirects");
}
