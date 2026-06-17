import { Injectable, Logger } from "@nestjs/common";
import type { Reminder } from "@prisma/client";
import type { ReminderNotification } from "@nodeira/shared-types";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsGateway } from "./notifications.gateway.js";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

interface ExpoPushMessage {
  to: string;
  title: string;
  body?: string;
  sound: "default";
  data: Record<string, unknown>;
}

/**
 * Delivers a fired reminder to all of a user's devices:
 *  - web/desktop clients currently connected → over the /notifications WS
 *  - mobile devices → Expo push (works even when the app is closed)
 *
 * The Expo push service is a simple HTTPS endpoint, so we call it directly with
 * the built-in fetch — no SDK dependency. Location reminders are NOT dispatched
 * here; those fire on-device via geofencing.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async dispatch(reminder: Reminder): Promise<void> {
    const payload: ReminderNotification = {
      reminderId: reminder.id,
      title: reminder.title,
      body: reminder.body,
      targetType: reminder.targetType,
      targetNoteId: reminder.targetNoteId,
      targetCanvasId: reminder.targetCanvasId,
      targetNodeId: reminder.targetNodeId,
      firedAt: new Date().toISOString(),
    };

    // 1. Connected web/desktop clients (in-memory; no-op if none online).
    this.gateway.sendToUser(reminder.userId, payload);

    // 2. Mobile devices via Expo push.
    await this.sendExpoPush(reminder.userId, payload);
  }

  private async sendExpoPush(userId: string, payload: ReminderNotification): Promise<void> {
    const devices = await this.prisma.device.findMany({
      where: { userId, pushToken: { not: null } },
      select: { pushToken: true },
    });

    const messages: ExpoPushMessage[] = [];
    const staleTokens: string[] = [];
    for (const { pushToken } of devices) {
      if (!pushToken) continue;
      if (!EXPO_PUSH_TOKEN_RE.test(pushToken)) {
        staleTokens.push(pushToken);
        continue;
      }
      messages.push({
        to: pushToken,
        title: payload.title,
        ...(payload.body ? { body: payload.body } : {}),
        sound: "default",
        data: { reminderId: payload.reminderId, targetType: payload.targetType },
      });
    }

    if (staleTokens.length > 0) {
      await this.prisma.device.deleteMany({ where: { pushToken: { in: staleTokens } } });
    }

    if (messages.length === 0) return;

    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.error(`Expo push HTTP ${res.status} for user ${userId}`);
      }
    } catch (err) {
      this.logger.error(`Expo push failed for user ${userId}: ${(err as Error).message}`);
    }
  }
}
