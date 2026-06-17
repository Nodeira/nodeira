import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Reminder } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateReminderDto } from "./dto/create-reminder.dto.js";
import type { UpdateReminderDto } from "./dto/update-reminder.dto.js";
import type { RegisterDeviceDto } from "./dto/register-device.dto.js";

@Injectable()
export class RemindersService {
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
      ? this.computeNextOccurrence(reminder.fireAt ?? now, reminder.recurrence, now)
      : null;

    await this.prisma.reminder.update({
      where: { id: reminder.id },
      data: next
        ? { status: "SCHEDULED", fireAt: next, snoozeUntil: null, lastFiredAt: now }
        : { status: "FIRED", snoozeUntil: null, lastFiredAt: now },
    });
  }

  /** Advance `from` by the recurrence interval until strictly after `now`. */
  computeNextOccurrence(from: Date, recurrence: string, now: Date): Date {
    const next = new Date(from);
    const advance = () => {
      switch (recurrence) {
        case "DAILY":
          next.setDate(next.getDate() + 1);
          break;
        case "WEEKLY":
          next.setDate(next.getDate() + 7);
          break;
        case "MONTHLY":
          next.setMonth(next.getMonth() + 1);
          break;
        case "YEARLY":
          next.setFullYear(next.getFullYear() + 1);
          break;
        default:
          next.setTime(now.getTime() + 60_000); // unknown cadence: nudge forward a minute
      }
    };
    do {
      advance();
    } while (next <= now);
    return next;
  }

  // --- Devices ---

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    // A push token uniquely identifies a physical device — upsert so re-registering
    // (e.g. token refresh on app launch) updates rather than duplicates.
    if (dto.pushToken) {
      return this.prisma.device.upsert({
        where: { userId_pushToken: { userId, pushToken: dto.pushToken } },
        update: { platform: dto.platform, name: dto.name ?? null, lastSeenAt: new Date() },
        create: {
          userId,
          platform: dto.platform,
          pushToken: dto.pushToken,
          name: dto.name ?? null,
        },
      });
    }
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
