import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Prisma, Reminder } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateReminderDto } from "./dto/create-reminder.dto.js";
import type { UpdateReminderDto } from "./dto/update-reminder.dto.js";
import type { RegisterDeviceDto } from "./dto/register-device.dto.js";
import {
  addRecurrence,
  instantFromWallClock,
  isValidTimeZone,
  wallClockIn,
  type Recurrence,
} from "./zoned-time.js";

const RECURRENCES: readonly string[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

function isRecurrence(value: string): value is Recurrence {
  return RECURRENCES.includes(value);
}

/** The reminder's zone when usable, UTC otherwise. Never throws on bad stored data. */
function resolveZone(timezone: string | null | undefined, logger: Logger): string {
  if (!timezone) return "UTC";
  if (isValidTimeZone(timezone)) return timezone;
  logger.warn(`Reminder has unknown time zone "${timezone}"; falling back to UTC`);
  return "UTC";
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Reminders CRUD ---

  create(userId: string, dto: CreateReminderDto): Promise<Reminder> {
    return this.prisma.reminder.create({
      data: {
        userId,
        title: dto.title,
        body: dto.body ?? null,
        targetType: dto.targetType ?? "NONE",
        targetNoteId: dto.targetNoteId ?? null,
        targetCanvasId: dto.targetCanvasId ?? null,
        targetNodeId: dto.targetNodeId ?? null,
        triggerType: dto.triggerType,
        fireAt: dto.fireAt ? new Date(dto.fireAt) : null,
        timezone: dto.timezone ?? null,
        recurrence: dto.recurrence ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        radiusM: dto.radiusM ?? null,
        locationName: dto.locationName ?? null,
        onLeave: dto.onLeave ?? false,
      },
    });
  }

  findAll(userId: string, status?: string): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({
      where: { userId, ...(status ? { status: status as Reminder["status"] } : {}) },
      orderBy: [{ fireAt: "asc" }, { createdAt: "desc" }],
    });
  }

  async findOne(userId: string, id: string): Promise<Reminder> {
    const reminder = await this.prisma.reminder.findUnique({ where: { id } });
    if (!reminder || reminder.userId !== userId) {
      throw new NotFoundException(`Reminder ${id} not found`);
    }
    return reminder;
  }

  async update(userId: string, id: string, dto: UpdateReminderDto): Promise<Reminder> {
    await this.findOne(userId, id);
    const data: Prisma.ReminderUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.body !== undefined && { body: dto.body }),
      ...(dto.targetType !== undefined && { targetType: dto.targetType }),
      ...(dto.targetNoteId !== undefined && { targetNoteId: dto.targetNoteId }),
      ...(dto.targetCanvasId !== undefined && { targetCanvasId: dto.targetCanvasId }),
      ...(dto.targetNodeId !== undefined && { targetNodeId: dto.targetNodeId }),
      ...(dto.triggerType !== undefined && { triggerType: dto.triggerType }),
      ...(dto.fireAt !== undefined && { fireAt: dto.fireAt ? new Date(dto.fireAt) : null }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.recurrence !== undefined && { recurrence: dto.recurrence }),
      ...(dto.lat !== undefined && { lat: dto.lat }),
      ...(dto.lng !== undefined && { lng: dto.lng }),
      ...(dto.radiusM !== undefined && { radiusM: dto.radiusM }),
      ...(dto.locationName !== undefined && { locationName: dto.locationName }),
      ...(dto.onLeave !== undefined && { onLeave: dto.onLeave }),
    };
    // Editing a fired/cancelled reminder reschedules it.
    if (dto.fireAt !== undefined) data.status = "SCHEDULED";
    return this.prisma.reminder.update({ where: { id }, data });
  }

  async remove(userId: string, id: string): Promise<Reminder> {
    await this.findOne(userId, id);
    return this.prisma.reminder.delete({ where: { id } });
  }

  async snooze(userId: string, id: string, until: string): Promise<Reminder> {
    await this.findOne(userId, id);
    return this.prisma.reminder.update({
      where: { id },
      data: { status: "SNOOZED", snoozeUntil: new Date(until) },
    });
  }

  async dismiss(userId: string, id: string): Promise<Reminder> {
    await this.findOne(userId, id);
    return this.prisma.reminder.update({
      where: { id },
      data: { status: "DISMISSED", snoozeUntil: null },
    });
  }

  // --- Scheduler support ---

  /** TIME reminders that are due now (one-shot or snoozed). */
  findDueTimeReminders(now: Date): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({
      where: {
        triggerType: "TIME",
        OR: [
          { status: "SCHEDULED", fireAt: { lte: now } },
          { status: "SNOOZED", snoozeUntil: { lte: now } },
        ],
      },
    });
  }

  /** After a reminder fires: advance recurring ones, otherwise mark FIRED. */
  async markFired(reminder: Reminder, now: Date): Promise<void> {
    const next = reminder.recurrence
      ? this.computeNextOccurrence(
          reminder.fireAt ?? now,
          reminder.recurrence,
          now,
          reminder.timezone,
        )
      : null;

    await this.prisma.reminder.update({
      where: { id: reminder.id },
      data: next
        ? { status: "SCHEDULED", fireAt: next, snoozeUntil: null, lastFiredAt: now }
        : { status: "FIRED", snoozeUntil: null, lastFiredAt: now },
    });
  }

  /**
   * Advance `from` by the recurrence interval until strictly after `now`, keeping the
   * reminder's wall-clock time in its own zone.
   *
   * `timezone` used to be written on every reminder and read by nothing: the arithmetic ran
   * on `Date.setDate`/`setMonth`, which work in the *server's* zone. A DAILY reminder for
   * 09:00 in a DST-observing zone therefore drifted to 08:00 or 10:00 twice a year, and the
   * same row produced different answers on servers deployed in different zones.
   *
   * A reminder with no zone falls back to UTC rather than server-local, so the result depends
   * on the data instead of on where the process happens to run.
   */
  computeNextOccurrence(from: Date, recurrence: string, now: Date, timezone?: string | null): Date {
    if (!isRecurrence(recurrence)) {
      // Unknown cadence: nudge forward a minute rather than loop forever.
      return new Date(now.getTime() + 60_000);
    }

    const zone = resolveZone(timezone, this.logger);
    let wall = wallClockIn(from, zone);
    let next = from;

    // Bounded so a pathological zone/step combination cannot spin. 4000 iterations covers
    // more than a decade of catching up a daily reminder.
    for (let i = 0; i < 4000 && next <= now; i++) {
      wall = addRecurrence(wall, recurrence);
      next = instantFromWallClock(wall, zone);
    }
    return next;
  }

  // --- Devices ---

  registerDevice(userId: string, dto: RegisterDeviceDto) {
    // Push tokens are gone: the Expo path they existed for was orphaned when the React
    // Native app was replaced. A device row is now just a record that a client connected.
    return this.prisma.device.create({
      data: { userId, platform: dto.platform, name: dto.name ?? null },
    });
  }

  listDevices(userId: string) {
    return this.prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" } });
  }

  async removeDevice(userId: string, id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device || device.userId !== userId) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return this.prisma.device.delete({ where: { id } });
  }
}
