/** What a reminder is attached to. NONE = standalone reminder. */
export type ReminderTargetType = "NONE" | "NOTE" | "CANVAS" | "CANVAS_NODE";

/** How a reminder fires. TIME = server-scheduled push; LOCATION = on-device geofence (mobile). */
export type ReminderTriggerType = "TIME" | "LOCATION";

export type ReminderStatus = "SCHEDULED" | "FIRED" | "DISMISSED" | "SNOOZED" | "CANCELLED";

/** Simple recurrence; null = one-shot. */
export type ReminderRecurrence = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type DevicePlatform = "ios" | "android" | "desktop" | "web";

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  body: string | null;

  // optional polymorphic target
  targetType: ReminderTargetType;
  targetNoteId: string | null;
  targetCanvasId: string | null;
  targetNodeId: string | null;

  triggerType: ReminderTriggerType;

  // TIME trigger
  fireAt: Date | null;
  timezone: string | null;
  recurrence: ReminderRecurrence | null;

  // LOCATION trigger (evaluated on-device; mobile only)
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  locationName: string | null;
  onLeave: boolean;

  status: ReminderStatus;
  snoozeUntil: Date | null;
  lastFiredAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface Device {
  id: string;
  userId: string;
  platform: DevicePlatform;
  pushToken: string | null;
  name: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

/** Payload pushed to clients (WS) or via Expo when a reminder fires. */
export interface ReminderNotification {
  reminderId: string;
  title: string;
  body: string | null;
  targetType: ReminderTargetType;
  targetNoteId: string | null;
  targetCanvasId: string | null;
  targetNodeId: string | null;
  firedAt: string; // ISO timestamp
}
