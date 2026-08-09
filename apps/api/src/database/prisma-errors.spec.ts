import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, it, expect } from "vitest";
import { isRecordNotFound, orNotFound } from "./prisma-errors.js";

/**
 * The blocks this replaces were `try { ... } catch { throw new NotFoundException(...) }` — a
 * dropped connection, a constraint violation or a bug in the query all reported "not found",
 * and the real error was discarded before anything could log it. The interesting assertion
 * here is therefore not that a missing row 404s; it is that everything else does not.
 */
function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test" });
}

describe("isRecordNotFound", () => {
  it("recognises P2025", () => {
    expect(isRecordNotFound(knownRequestError("P2025"))).toBe(true);
  });

  it("rejects other Prisma codes", () => {
    // P2002 unique constraint, P2003 foreign key, P1001 unreachable database.
    for (const code of ["P2002", "P2003", "P1001"]) {
      expect(isRecordNotFound(knownRequestError(code))).toBe(false);
    }
  });

  it("rejects non-Prisma errors and junk", () => {
    expect(isRecordNotFound(new Error("P2025"))).toBe(false);
    expect(isRecordNotFound({ code: "P2025" })).toBe(false);
    expect(isRecordNotFound(null)).toBe(false);
    expect(isRecordNotFound(undefined)).toBe(false);
  });
});

describe("orNotFound", () => {
  it("passes a successful result straight through", async () => {
    await expect(orNotFound(Promise.resolve({ id: "n1" }), "nope")).resolves.toEqual({ id: "n1" });
  });

  it("turns a missing row into NotFoundException with the given message", async () => {
    const promise = orNotFound(Promise.reject(knownRequestError("P2025")), "Note n1 not found");
    await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    await expect(promise).rejects.toThrow("Note n1 not found");
  });

  it("lets a unique-constraint violation through as itself", async () => {
    const original = knownRequestError("P2002");
    await expect(orNotFound(Promise.reject(original), "Note n1 not found")).rejects.toBe(original);
  });

  it("lets an unreachable database through rather than reporting 404", async () => {
    // The failure mode that mattered: the client was told the row did not exist while the
    // database was simply down, and the operator saw nothing.
    const original = knownRequestError("P1001");
    await expect(orNotFound(Promise.reject(original), "Note n1 not found")).rejects.toBe(original);
  });

  it("lets an ordinary Error through", async () => {
    const original = new Error("something else entirely");
    await expect(orNotFound(Promise.reject(original), "Note n1 not found")).rejects.toBe(original);
  });
});
