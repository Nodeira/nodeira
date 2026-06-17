import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import type { Reminder } from "@nodeira/shared-types";
import { registerDevice } from "./reminders";

const GEOFENCE_TASK = "nodeira-geofence";
const GEOFENCE_META_KEY = "nodeira_geofence_meta";

interface GeofenceMeta {
  title: string;
  body: string | null;
  onLeave: boolean;
}

// Foreground presentation: show an alert + play a sound while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * OS-level geofence task. Runs even when the app is backgrounded/closed. On the
 * relevant transition (enter, or exit when onLeave) it presents a local
 * notification using metadata cached at sync time (the task has no network/auth).
 */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_META_KEY);
    const meta: Record<string, GeofenceMeta> = raw ? JSON.parse(raw) : {};
    const entry = meta[region.identifier ?? ""];
    if (!entry) return;

    const entered = eventType === Location.GeofencingEventType.Enter;
    const fireOnThis = entry.onLeave ? !entered : entered;
    if (!fireOnThis) return;

    await Notifications.scheduleNotificationAsync({
      content: { title: entry.title, body: entry.body ?? undefined, sound: "default" },
      trigger: null, // present immediately
    });
  } catch {
    /* swallow — background task must never throw */
  }
});

/** Request notification permission, fetch the Expo push token, register the device. */
export async function registerForPushAsync(): Promise<void> {
  if (!Device.isDevice) return; // push tokens require a physical device

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return;

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform = Platform.OS === "ios" ? "ios" : "android";
  await registerDevice({ platform, pushToken, name: Device.deviceName ?? undefined });
}

/**
 * Register OS geofences for the user's LOCATION reminders. Caches the metadata
 * the background task needs, then (re)starts geofencing. iOS caps active
 * geofences at ~20, so we keep the first 20.
 */
export async function syncGeofences(reminders: Reminder[]): Promise<void> {
  const locationReminders = reminders.filter(
    (r) =>
      r.triggerType === "LOCATION" &&
      (r.status === "SCHEDULED" || r.status === "SNOOZED") &&
      r.lat != null &&
      r.lng != null &&
      r.radiusM != null,
  );

  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);

  if (locationReminders.length === 0) {
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined);
    await AsyncStorage.removeItem(GEOFENCE_META_KEY);
    return;
  }

  // Background location ("Always") is required for geofences to fire when closed.
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return;

  const capped = locationReminders.slice(0, 20);
  const regions: Location.LocationRegion[] = capped.map((r) => ({
    identifier: r.id,
    latitude: r.lat as number,
    longitude: r.lng as number,
    radius: r.radiusM as number,
    notifyOnEnter: !r.onLeave,
    notifyOnExit: r.onLeave,
  }));

  const meta: Record<string, GeofenceMeta> = {};
  for (const r of capped) {
    meta[r.id] = { title: r.title, body: r.body, onLeave: r.onLeave };
  }
  await AsyncStorage.setItem(GEOFENCE_META_KEY, JSON.stringify(meta));

  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}
