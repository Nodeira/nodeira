import type { Device, Reminder } from "@nodeira/shared-types";
import { api } from "./api";

export const remindersKeys = {
  all: ["reminders"] as const,
};

interface RawReminder extends Omit<
  Reminder,
  "fireAt" | "snoozeUntil" | "lastFiredAt" | "createdAt" | "updatedAt"
> {
  fireAt: string | null;
  snoozeUntil: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseReminder(raw: RawReminder): Reminder {
  return {
    ...raw,
    fireAt: raw.fireAt ? new Date(raw.fireAt) : null,
    snoozeUntil: raw.snoozeUntil ? new Date(raw.snoozeUntil) : null,
    lastFiredAt: raw.lastFiredAt ? new Date(raw.lastFiredAt) : null,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export interface CreateReminderBody {
  title: string;
  body?: string;
  targetType?: Reminder["targetType"];
  targetNoteId?: string;
  targetCanvasId?: string;
  targetNodeId?: string;
  triggerType: Reminder["triggerType"];
  fireAt?: string;
  timezone?: string;
  recurrence?: Reminder["recurrence"];
  lat?: number;
  lng?: number;
  radiusM?: number;
  locationName?: string;
  onLeave?: boolean;
}

export async function getReminders(): Promise<Reminder[]> {
  const raw = await api.get<RawReminder[]>("/reminders");
  return raw.map(parseReminder);
}

export async function createReminder(body: CreateReminderBody): Promise<Reminder> {
  const raw = await api.post<RawReminder>("/reminders", body);
  return parseReminder(raw);
}

/** Partial update of any reminder field (PATCH /reminders/:id). */
export type UpdateReminderBody = Partial<CreateReminderBody>;

export async function updateReminder(id: string, body: UpdateReminderBody): Promise<Reminder> {
  const raw = await api.patch<RawReminder>(`/reminders/${id}`, body);
  return parseReminder(raw);
}

export async function snoozeReminder(id: string, until: string): Promise<Reminder> {
  const raw = await api.post<RawReminder>(`/reminders/${id}/snooze`, { until });
  return parseReminder(raw);
}

export async function dismissReminder(id: string): Promise<Reminder> {
  const raw = await api.post<RawReminder>(`/reminders/${id}/dismiss`, {});
  return parseReminder(raw);
}

export async function deleteReminder(id: string): Promise<void> {
  await api.delete<void>(`/reminders/${id}`);
}

export async function registerDevice(body: {
  platform: Device["platform"];
  pushToken?: string;
  name?: string;
}): Promise<Device> {
  return api.post<Device>("/devices", body);
}
