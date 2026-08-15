/**
 * Calendar arithmetic in a named IANA time zone, built on `Intl` so it costs no dependency.
 *
 * Why this exists: recurrence used `Date.prototype.setDate`/`setMonth`, which operate in
 * whatever zone the *server* happens to run in. Two consequences, both real:
 *
 *  - A DAILY reminder set for 09:00 in a zone that observes DST drifted by an hour twice a
 *    year, because "+1 day" was computed as a fixed 24-hour step against a UTC instant.
 *  - The same row produced different next-occurrences on a server in UTC and one in
 *    America/Chicago, so behaviour depended on deployment rather than on the data.
 *
 * The fix is to do the arithmetic on *wall-clock* fields in the reminder's own zone and
 * convert back to an instant, which is what a person means by "every day at nine".
 */

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** True when `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock an observer in `timeZone` reads at `instant`. */
export function wallClockIn(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const field = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value;
    return value === undefined ? 0 : Number(value);
  };
  return {
    year: field("year"),
    month: field("month"),
    day: field("day"),
    hour: field("hour"),
    minute: field("minute"),
    second: field("second"),
  };
}

/** Milliseconds to add to an instant to get the wall clock read in `timeZone`. */
function offsetAt(instantMs: number, timeZone: string): number {
  const w = wallClockIn(new Date(instantMs), timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // formatToParts drops sub-second precision; keep it out of the offset.
  return asUtc - (instantMs - (instantMs % 1000));
}

/**
 * The instant at which `wall` is the local time in `timeZone`.
 *
 * Two passes: guess the instant as if the wall clock were UTC, measure the zone's offset
 * there, then re-measure at the corrected instant in case the first guess landed on the far
 * side of a DST transition.
 *
 * DST edges are resolved deterministically rather than rejected:
 *
 *  - **Spring-forward gap** — 02:30 simply does not happen on the day clocks jump 02:00 → 03:00.
 *    The second pass would resolve it *backwards*, to 01:30, firing an hour early and before
 *    the previous occurrence. Detected by reading the result back and finding it disagrees
 *    with what was asked for, and answered with the first pass instead, which lands after the
 *    gap (03:30). Rolling forward is the calendar convention and the less surprising miss.
 *  - **Fall-back overlap** — 01:30 happens twice. The earlier of the two is chosen.
 */
export function instantFromWallClock(wall: WallClock, timeZone: string): Date {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const forward = guess - offsetAt(guess, timeZone);
  const settled = guess - offsetAt(forward, timeZone);

  const readBack = wallClockIn(new Date(settled), timeZone);
  const exact =
    readBack.year === wall.year &&
    readBack.month === wall.month &&
    readBack.day === wall.day &&
    readBack.hour === wall.hour &&
    readBack.minute === wall.minute;

  return new Date(exact ? settled : forward);
}

export type Recurrence = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/**
 * Adds one recurrence step to a wall clock.
 *
 * Month and year steps roll over rather than clamp — 31 January + 1 month lands in March,
 * matching what the previous `Date.setMonth` arithmetic did. Clamping to the last day of the
 * month is arguably friendlier, but it is a change in recurrence semantics rather than a
 * timezone fix, so it is left alone deliberately.
 */
export function addRecurrence(wall: WallClock, recurrence: Recurrence): WallClock {
  const stepped = new Date(
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second),
  );
  switch (recurrence) {
    case "DAILY":
      stepped.setUTCDate(stepped.getUTCDate() + 1);
      break;
    case "WEEKLY":
      stepped.setUTCDate(stepped.getUTCDate() + 7);
      break;
    case "MONTHLY":
      stepped.setUTCMonth(stepped.getUTCMonth() + 1);
      break;
    case "YEARLY":
      stepped.setUTCFullYear(stepped.getUTCFullYear() + 1);
      break;
  }
  return {
    year: stepped.getUTCFullYear(),
    month: stepped.getUTCMonth() + 1,
    day: stepped.getUTCDate(),
    hour: stepped.getUTCHours(),
    minute: stepped.getUTCMinutes(),
    second: stepped.getUTCSeconds(),
  };
}
