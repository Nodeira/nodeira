import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import type { Reminder } from "@nodeira/shared-types";

import { TopBar } from "@/components/TopBar";
import {
  createReminder,
  deleteReminder,
  dismissReminder,
  getReminders,
  remindersKeys,
  type CreateReminderBody,
} from "@/lib/reminders";
import { syncGeofences } from "@/lib/notifications";

const ACTIVE: Reminder["status"][] = ["SCHEDULED", "SNOOZED"];

export default function RemindersScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const bgSubtle = dark ? "#25262b" : "#f8f9fa";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";

  const {
    data: reminders,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: remindersKeys.all,
    queryFn: getReminders,
  });

  // Whenever the reminder list changes, re-register on-device geofences.
  useEffect(() => {
    if (reminders) void syncGeofences(reminders);
  }, [reminders]);

  const invalidate = () => qc.invalidateQueries({ queryKey: remindersKeys.all });
  const createMutation = useMutation({
    mutationFn: (body: CreateReminderBody) => createReminder(body),
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
    onError: () => Alert.alert("Error", "Couldn't create reminder"),
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissReminder(id),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: invalidate,
  });

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function createAt(when: Date) {
    if (!title.trim()) {
      Alert.alert("Add a title", "Give your reminder a title first.");
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      triggerType: "TIME",
      fireAt: when.toISOString(),
      timezone: tz,
    });
  }

  function inOneHour() {
    createAt(new Date(Date.now() + 60 * 60 * 1000));
  }

  function tomorrowMorning() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    createAt(d);
  }

  async function createHere() {
    if (!title.trim()) {
      Alert.alert("Add a title", "Give your reminder a title first.");
      return;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Location needed", "Grant location access to set a place reminder.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    createMutation.mutate({
      title: title.trim(),
      triggerType: "LOCATION",
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      radiusM: 1609,
      locationName: "Current location",
      onLeave: false,
    });
  }

  function whenLabel(r: Reminder): string {
    if (r.triggerType === "LOCATION") {
      return `${r.onLeave ? "Leaving" : "Near"} ${r.locationName ?? "a place"}`;
    }
    const at = r.snoozeUntil ?? r.fireAt;
    return at ? new Date(at).toLocaleString() : "—";
  }

  const list = [...(reminders ?? [])].sort((a, b) => {
    const aActive = ACTIVE.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (
      (a.fireAt ? new Date(a.fireAt).getTime() : 0) - (b.fireAt ? new Date(b.fireAt).getTime() : 0)
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <TopBar title="Reminders" onBack={() => router.back()} />

      {/* Quick create */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bgSubtle,
          gap: 10,
        }}
      >
        <TextInput
          placeholder="Remind me to…"
          placeholderTextColor={textMute}
          value={title}
          onChangeText={setTitle}
          style={{
            fontSize: 15,
            color: textColor,
            backgroundColor: bg,
            borderWidth: 1,
            borderColor: border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { label: "In 1 hour", icon: "clock", onPress: inOneHour },
            { label: "Tomorrow 9am", icon: "sunrise", onPress: tomorrowMorning },
            { label: "Here", icon: "map-pin", onPress: createHere },
          ].map((b) => (
            <Pressable
              key={b.label}
              onPress={b.onPress}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingVertical: 9,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: bg,
              }}
            >
              <Feather name={b.icon as "clock"} size={13} color="#4263eb" />
              <Text style={{ fontSize: 12, fontWeight: "500", color: textColor }}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4263eb" />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={{ paddingTop: 48, alignItems: "center" }}>
              <Feather name="bell" size={28} color={textMute} />
              <Text style={{ fontSize: 14, color: textMute, marginTop: 12 }}>No reminders yet</Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const active = ACTIVE.includes(r.status);
            return (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: border,
                  backgroundColor: bg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  opacity: active ? 1 : 0.55,
                }}
              >
                <Feather
                  name={r.triggerType === "LOCATION" ? "map-pin" : "clock"}
                  size={16}
                  color="#4263eb"
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: textColor }}
                    numberOfLines={1}
                  >
                    {r.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: textMute, marginTop: 2 }}>
                    {whenLabel(r)}
                  </Text>
                </View>
                {active && (
                  <Pressable onPress={() => dismissMutation.mutate(r.id)} hitSlop={8}>
                    <Feather name="check" size={18} color={textMute} />
                  </Pressable>
                )}
                <Pressable onPress={() => deleteMutation.mutate(r.id)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color="#fa5252" />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
