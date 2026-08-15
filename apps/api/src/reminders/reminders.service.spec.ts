import { Test } from "@nestjs/testing";
import { describe, it, expect, beforeEach } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { RemindersService } from "./reminders.service.js";
import { wallClockIn } from "./zoned-time.js";

/**
 * `Reminder.timezone` was written on every reminder and read by nothing. Recurrence advanced
 * with `Date.setDate`/`setMonth`, which work in the server's zone, so a daily 09:00 reminder
 * drifted by an hour across a DST boundary — and drifted differently depending on where the
 * server was deployed.
 *
 * These pin the wall clock, which is the thing a person actually means by "every day at 9".
 */
let service: RemindersService;

beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({
    providers: [RemindersService, { provide: PrismaService, useValue: {} }],
  }).compile();
  service = moduleRef.get(RemindersService);
});

const NY = "America/New_York";

describe("computeNextOccurrence", () => {
  it("keeps 09:00 local across the spring-forward boundary", () => {
    // 2026-03-07 09:00 EST. DST starts on the 8th, so a naive +24h lands at 10:00 local.
    const from = new Date("2026-03-07T14:00:00Z");
    const now = new Date("2026-03-07T14:00:01Z");

    const next = service.computeNextOccurrence(from, "DAILY", now, NY);

    expect(wallClockIn(next, NY).hour).toBe(9);
    expect(wallClockIn(next, NY).day).toBe(8);
    expect(next.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  it("keeps 09:00 local across the fall-back boundary", () => {
    // 2026-10-31 09:00 EDT; DST ends 2026-11-01.
    const from = new Date("2026-10-31T13:00:00Z");
    const now = new Date("2026-10-31T13:00:01Z");

    const next = service.computeNextOccurrence(from, "DAILY", now, NY);

    expect(wallClockIn(next, NY).hour).toBe(9);
    expect(next.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("catches up past a long gap and still lands on the right wall clock", () => {
    const from = new Date("2026-01-05T14:00:00Z"); // 09:00 EST
    const now = new Date("2026-07-01T00:00:00Z"); // months later, and DST has flipped

    const next = service.computeNextOccurrence(from, "DAILY", now, NY);

    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(wallClockIn(next, NY).hour).toBe(9);
  });

  it("uses the reminder's zone, not the server's, across a transition only that zone has", () => {
    // Europe/Paris springs forward on 2026-03-29; America/New_York did so on 2026-03-08. A
    // server running in New York sees no transition here at all, so the old server-local
    // arithmetic produced 10:00 Paris — an hour late — while a UTC server produced 09:00.
    // This is the case that distinguishes "honours the column" from "happens to agree".
    const paris = "Europe/Paris";
    const from = new Date("2026-03-28T08:00:00Z"); // 09:00 CET
    const now = new Date("2026-03-28T08:00:01Z");

    const next = service.computeNextOccurrence(from, "DAILY", now, paris);

    expect(wallClockIn(next, paris).hour).toBe(9);
    expect(next.toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("advances weekly on the same weekday and time", () => {
    const from = new Date("2026-03-07T14:00:00Z"); // Saturday 09:00 EST
    const now = new Date("2026-03-07T14:00:01Z");

    const next = service.computeNextOccurrence(from, "WEEKLY", now, NY);

    const wall = wallClockIn(next, NY);
    expect([wall.month, wall.day, wall.hour]).toEqual([3, 14, 9]);
  });

  it("falls back to UTC when the reminder has no zone", () => {
    // Deterministic regardless of the server's TZ, which is the point.
    const from = new Date("2026-03-07T14:00:00Z");
    const now = new Date("2026-03-07T14:00:01Z");

    const next = service.computeNextOccurrence(from, "DAILY", now, null);

    expect(next.toISOString()).toBe("2026-03-08T14:00:00.000Z");
  });

  it("falls back to UTC rather than throwing on an unknown stored zone", () => {
    const from = new Date("2026-03-07T14:00:00Z");
    const now = new Date("2026-03-07T14:00:01Z");

    const next = service.computeNextOccurrence(from, "DAILY", now, "Mars/Olympus_Mons");

    expect(next.toISOString()).toBe("2026-03-08T14:00:00.000Z");
  });

  it("nudges forward on an unrecognised cadence instead of looping", () => {
    const now = new Date("2026-03-07T14:00:00Z");
    const next = service.computeNextOccurrence(now, "FORTNIGHTLY", now, NY);
    expect(next.getTime()).toBe(now.getTime() + 60_000);
  });

  it("always returns an instant strictly after now", () => {
    const from = new Date("2020-01-01T09:00:00Z");
    const now = new Date("2026-08-09T12:34:56Z");
    for (const recurrence of ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]) {
      const next = service.computeNextOccurrence(from, recurrence, now, NY);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});
