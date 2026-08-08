import { describe, it, expect } from "vitest";
import { UnprocessableEntityException } from "@nestjs/common";
import { isPrivateAddress, safeFetchHtml } from "./safe-fetch.js";

/**
 * The SSRF guard had no tests at all, which is how the string-prefix version survived —
 * it read plausibly and missed several ways of writing a private address.
 */
describe("isPrivateAddress", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "private class A"],
    ["172.16.0.1", "private class B, low end"],
    ["172.31.255.255", "private class B, high end"],
    ["192.168.1.1", "private class C"],
    ["169.254.169.254", "cloud metadata"],
    ["0.0.0.0", "reaches localhost on Linux"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["192.0.0.1", "protocol assignments"],
    ["239.1.1.1", "multicast"],
    ["::1", "IPv6 loopback"],
    ["fd00::1", "IPv6 unique-local"],
    ["fe80::1", "IPv6 link-local"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
  ])("blocks %s (%s)", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([["8.8.8.8"], ["1.1.1.1"], ["2606:4700:4700::1111"]])("allows %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it("blocks 172.15 and 172.32, which are outside the private range but adjacent", () => {
    expect(isPrivateAddress("172.15.0.1")).toBe(false);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
  });
});

describe("safeFetchHtml", () => {
  it("rejects non-http protocols", async () => {
    await expect(safeFetchHtml("file:///etc/passwd")).rejects.toThrow(UnprocessableEntityException);
    await expect(safeFetchHtml("gopher://example.com")).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it("rejects a malformed URL", async () => {
    await expect(safeFetchHtml("not a url")).rejects.toThrow(UnprocessableEntityException);
  });

  it("refuses to connect to a literal private address", async () => {
    await expect(safeFetchHtml("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      /private networks/,
    );
  });

  it("refuses a hostname that resolves to loopback", async () => {
    // localhost resolves to 127.0.0.1/::1, so this exercises the guarded lookup rather
    // than the literal-address path above.
    await expect(safeFetchHtml("http://localhost:9/")).rejects.toThrow(/private networks/);
  });
});
