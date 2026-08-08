import { Injectable, Logger } from "@nestjs/common";
import type { Reminder } from "@prisma/client";
import type { ReminderNotification } from "@nodeira/shared-types";
import { NotificationsGateway } from "./notifications.gateway.js";

/**
 * Delivers a fired reminder to every web or desktop client the user currently has
 * connected, over the /notifications WebSocket.
 *
 * There used to be a second path here that pushed to Expo. It was left behind when the
 * React Native app was replaced by the native Kotlin one, which never registered a push
 * token — so it dispatched to nobody for months. Android reminders fire on-device via
 * AlarmManager, and location reminders have always fired on-device via geofencing.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(private readonly gateway: NotificationsGateway) {}

  dispatch(reminder: Reminder): void {
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

    // In-memory fan-out; a no-op when the user has nothing connected.
    this.gateway.sendToUser(reminder.userId, payload);
  }
}
