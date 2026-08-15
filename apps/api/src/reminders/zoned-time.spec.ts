import { describe, it, expect } from "vitest";
import { addRecurrence, instantFromWallClock, isValidTimeZone, wallClockIn } from "./zoned-time.js";

const NY = "America/New_York";

describe("wallClockIn", () => {
  it("reads the local clock in the target zone", () => {
    // 2026-03-07T14:30:00Z is 09:30 in New York (EST, UTC-5).
    expect(wallClockIn(new Date("2026-03-07T14:30:00Z"), NY)).toEqual({
      year: 2026,
      month: 3,
      day: 7,
      hour: 9,
      minute: 30,
      second: 0,
    });
  });

  it("tracks the offset change across a DST boundary", () => {
    // Same UTC time a week later, after the spring-forward: now EDT (UTC-4).
    expect(wallClockIn(new Date("2026-03-14T14:30:00Z"), NY).hour).toBe(10);
    expect(wallClockIn(new Date("2026-03-21T14:30:00Z"), NY).hour).toBe(10);
  });
});

describe("instantFromWallClock", () => {
  it("round-trips an ordinary time", () => {
    const wall = { year: 2026, month: 3, day: 7, hour: 9, minute: 30, second: 0 };
    const instant = instantFromWallClock(wall, NY);
    expect(instant.toISOString()).toBe("2026-03-07T14:30:00.000Z");
    expect(wallClockIn(instant, NY)).toEqual(wall);
  });

  it("round-trips on the far side of a DST transition", () => {
    const wall = { year: 2026, month: 3, day: 9, hour: 9, minute: 30, second: 0 };
    const instant = instantFromWallClock(wall, NY);
    // EDT by then, so 09:30 local is 13:30Z rather than 14:30Z.
    expect(instant.toISOString()).toBe("2026-03-09T13:30:00.000Z");
    expect(wallClockIn(instant, NY)).toEqual(wall);
  });

  it("rolls a wall clock inside the spring-forward gap forward, not backward", () => {
    // 02:30 on 2026-03-08 never happens in New York (clocks jump 02:00 -> 03:00). Resolving
    // it backwards to 01:30 would fire early and land *before* the previous occurrence.
    const instant = instantFromWallClock(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 },
      NY,
    );
    const back = wallClockIn(instant, NY);
    expect([back.day, back.hour, back.minute]).toEqual([8, 3, 30]);
  });

  it("picks the earlier instant when a wall clock happens twice", () => {
    // 2026-11-01: clocks fall back 02:00 EDT -> 01:00 EST, so 01:30 occurs at 05:30Z and again
    // at 06:30Z. Either is defensible; pinning it keeps the choice from drifting silently.
    const instant = instantFromWallClock(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 },
      NY,
    );
    expect(instant.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("handles UTC", () => {
    const wall = { year: 2026, month: 6, day: 1, hour: 12, minute: 0, second: 0 };
    expect(instantFromWallClock(wall, "UTC").toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });
});

describe("addRecurrence", () => {
  const base = { year: 2026, month: 1, day: 31, hour: 9, minute: 0, second: 0 };

  it("adds a day", () => {
    expect(addRecurrence({ ...base, day: 1 }, "DAILY").day).toBe(2);
  });

  it("adds a week across a month boundary", () => {
    const next = addRecurrence({ ...base, day: 28 }, "WEEKLY");
    expect([next.month, next.day]).toEqual([2, 4]);
  });

  it("rolls a month step over a short month, as the previous implementation did", () => {
    // 31 Jan + 1 month has no 31 Feb; this rolls into March rather than clamping. Preserved
    // deliberately — clamping would be a change to recurrence semantics, not a zone fix.
    const next = addRecurrence(base, "MONTHLY");
    expect(next.month).toBe(3);
  });

  it("adds a year", () => {
    expect(addRecurrence(base, "YEARLY").year).toBe(2027);
  });

  it("keeps the time of day", () => {
    const next = addRecurrence({ ...base, hour: 9, minute: 15, second: 30 }, "DAILY");
    expect([next.hour, next.minute, next.second]).toEqual([9, 15, 30]);
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones", () => {
    for (const zone of ["UTC", NY, "Europe/Paris", "Asia/Kolkata"]) {
      expect(isValidTimeZone(zone)).toBe(true);
    }
  });

  it("rejects nonsense", () => {
    for (const zone of ["", "Mars/Olympus_Mons", "EST5EDT_NOPE", "not a zone"]) {
      expect(isValidTimeZone(zone)).toBe(false);
    }
  });
});
