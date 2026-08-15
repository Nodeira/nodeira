import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Prisma's "an operation failed because it depends on one or more records that were required
 * but not found". The only Prisma failure that legitimately means 404.
 */
const RECORD_NOT_FOUND = "P2025";

export function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === RECORD_NOT_FOUND;
}

/**
 * Awaits `operation`, converting a missing row into `NotFoundException` and letting every
 * other failure through unchanged.
 *
 * Services wrote this as a bare `try { ... } catch { throw new NotFoundException(...) }`, which
 * reports a dropped connection, a constraint violation, a serialization failure and a genuine
 * 500 as "not found". The client is told the row does not exist; the real error is discarded
 * before anything can log it. This narrows that to the one error code that means what the
 * message says.
 */
export async function orNotFound<T>(operation: Promise<T>, message: string): Promise<T> {
  try {
    return await operation;
  } catch (err) {
    if (isRecordNotFound(err)) throw new NotFoundException(message);
    throw err;
  }
}
