import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Reminder, ReminderRecurrence } from "@nodeira/shared-types";

import type { CreateReminderBody } from "@/lib/reminders";

interface ReminderEditorProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (body: CreateReminderBody) => void;
  /** When set, the editor edits an existing reminder instead of creating one. */
  initial?: Reminder | null;
  /** Pre-fills the title when creating (ignored when editing). */
  initialTitle?: string;
  submitting?: boolean;
}

type Trigger = "TIME" | "LOCATION";

const DEFAULT_RADIUS_M = 1609; // ~1 mile

const RECURRENCE_OPTIONS: { label: string; value: ReminderRecurrence | "" }[] = [
  { label: "Once", value: "" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Yearly", value: "YEARLY" },
];

function oneHourFromNow(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

export function ReminderEditor({
  visible,
  onClose,
  onSubmit,
  initial,
  initialTitle,
  submitting,
}: ReminderEditorProps) {
  const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const bgSubtle = dark ? "#25262b" : "#f8f9fa";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";
  const accent = "#4263eb";

  const isEdit = !!initial;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [trigger, setTrigger] = useState<Trigger>("TIME");

  // TIME fields
  const [fireAt, setFireAt] = useState<Date>(oneHourFromNow());
  const [recurrence, setRecurrence] = useState<ReminderRecurrence | "">("");
  const [showIosPicker, setShowIosPicker] = useState(false);

  // LOCATION fields
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState("" + DEFAULT_RADIUS_M);
  const [locationName, setLocationName] = useState("");
  const [onLeave, setOnLeave] = useState(false);
  const [locating, setLocating] = useState(false);

  // Re-seed the form whenever the modal opens (create = blank, edit = prefilled).
  // Tracking the visible+id pair avoids clobbering edits on every render.
  const seedKey = `${visible}:${initial?.id ?? "new"}`;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (visible && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setTitle(initial?.title ?? initialTitle ?? "");
    setBody(initial?.body ?? "");
    setTrigger(initial?.triggerType ?? "TIME");
    setFireAt(initial?.fireAt ? new Date(initial.fireAt) : oneHourFromNow());
    setRecurrence(initial?.recurrence ?? "");
    setShowIosPicker(false);
    setLat(initial?.lat ?? null);
    setLng(initial?.lng ?? null);
    setRadius("" + (initial?.radiusM ?? DEFAULT_RADIUS_M));
    setLocationName(initial?.locationName ?? "");
    setOnLeave(initial?.onLeave ?? false);
    setLocating(false);
  } else if (!visible && seededFor !== null) {
    setSeededFor(null);
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function pickDateTime() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: fireAt,
        mode: "date",
        onChange: (_e, date) => {
          if (!date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            is24Hour: false,
            onChange: (_e2, time) => {
              if (!time) return;
              const combined = new Date(date);
              combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
              setFireAt(combined);
            },
          });
        },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location needed", "Grant location access to set a place reminder.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      if (!locationName.trim()) setLocationName("Current location");
    } catch {
      Alert.alert("Error", "Couldn't get your current location.");
    } finally {
      setLocating(false);
    }
  }

  const radiusM = Number.parseInt(radius, 10);
  const locationValid = lat != null && lng != null && Number.isFinite(radiusM) && radiusM >= 50;

  function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Add a title", "Give your reminder a title first.");
      return;
    }

    const base: CreateReminderBody = {
      title: title.trim(),
      ...(body.trim() ? { body: body.trim() } : {}),
      triggerType: trigger,
    };

    if (trigger === "TIME") {
      base.fireAt = fireAt.toISOString();
      base.timezone = timezone;
      if (recurrence) base.recurrence = recurrence;
    } else {
      if (!locationValid) {
        Alert.alert("Set a place", "Choose a location and a radius of at least 50 m.");
        return;
      }
      base.lat = lat as number;
      base.lng = lng as number;
      base.radiusM = radiusM;
      if (locationName.trim()) base.locationName = locationName.trim();
      base.onLeave = onLeave;
    }

    onSubmit(base);
  }

  const inputStyle = {
    fontSize: 15,
    color: textColor,
    backgroundColor: bgSubtle,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const;

  const labelStyle = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: textMute,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ fontSize: 15, color: textMute }}>Cancel</Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: textColor,
            }}
          >
            {isEdit ? "Edit reminder" : "New reminder"}
          </Text>
          <Pressable onPress={handleSubmit} hitSlop={8} disabled={submitting}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: accent }}>
              {submitting ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <View>
              <Text style={labelStyle}>Title</Text>
              <TextInput
                placeholder="Remind me to…"
                placeholderTextColor={textMute}
                value={title}
                onChangeText={setTitle}
                style={inputStyle}
              />
            </View>

            {/* Notes */}
            <View>
              <Text style={labelStyle}>Notes</Text>
              <TextInput
                placeholder="Optional details"
                placeholderTextColor={textMute}
                value={body}
                onChangeText={setBody}
                multiline
                style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
              />
            </View>

            {/* Trigger toggle */}
            <View>
              <Text style={labelStyle}>Trigger</Text>
              <View
                style={{
                  flexDirection: "row",
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {(["TIME", "LOCATION"] as const).map((t) => {
                  const active = trigger === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setTrigger(t)}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 10,
                        backgroundColor: active ? accent : bgSubtle,
                      }}
                    >
                      <Feather
                        name={t === "TIME" ? "clock" : "map-pin"}
                        size={14}
                        color={active ? "#fff" : textMute}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: active ? "#fff" : textColor,
                        }}
                      >
                        {t === "TIME" ? "At a time" : "At a place"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {trigger === "TIME" ? (
              <>
                {/* When */}
                <View>
                  <Text style={labelStyle}>When</Text>
                  <Pressable
                    onPress={pickDateTime}
                    style={[inputStyle, { flexDirection: "row", alignItems: "center", gap: 8 }]}
                  >
                    <Feather name="calendar" size={15} color={accent} />
                    <Text style={{ fontSize: 15, color: textColor }}>
                      {fireAt.toLocaleString()}
                    </Text>
                  </Pressable>
                  {Platform.OS === "ios" && showIosPicker && (
                    <DateTimePicker
                      value={fireAt}
                      mode="datetime"
                      display="spinner"
                      onChange={(_e, d) => {
                        if (d) setFireAt(d);
                      }}
                    />
                  )}
                </View>

                {/* Recurrence */}
                <View>
                  <Text style={labelStyle}>Repeat</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {RECURRENCE_OPTIONS.map((opt) => {
                      const active = recurrence === opt.value;
                      return (
                        <Pressable
                          key={opt.value || "once"}
                          onPress={() => setRecurrence(opt.value)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: active ? accent : border,
                            backgroundColor: active ? accent : bgSubtle,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "500",
                              color: active ? "#fff" : textColor,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Place name */}
                <View>
                  <Text style={labelStyle}>Place name</Text>
                  <TextInput
                    placeholder="e.g. Home, Office"
                    placeholderTextColor={textMute}
                    value={locationName}
                    onChangeText={setLocationName}
                    style={inputStyle}
                  />
                </View>

                {/* Coordinates */}
                <View>
                  <Text style={labelStyle}>Location</Text>
                  <Pressable
                    onPress={useCurrentLocation}
                    disabled={locating}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: accent,
                      backgroundColor: bgSubtle,
                      marginBottom: 8,
                    }}
                  >
                    <Feather name="crosshair" size={15} color={accent} />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: accent }}>
                      {locating ? "Locating…" : "Use current location"}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      placeholder="Latitude"
                      placeholderTextColor={textMute}
                      value={lat != null ? String(lat) : ""}
                      onChangeText={(t) => {
                        const n = Number.parseFloat(t);
                        setLat(t.trim() === "" || Number.isNaN(n) ? null : n);
                      }}
                      keyboardType="numbers-and-punctuation"
                      style={[inputStyle, { flex: 1 }]}
                    />
                    <TextInput
                      placeholder="Longitude"
                      placeholderTextColor={textMute}
                      value={lng != null ? String(lng) : ""}
                      onChangeText={(t) => {
                        const n = Number.parseFloat(t);
                        setLng(t.trim() === "" || Number.isNaN(n) ? null : n);
                      }}
                      keyboardType="numbers-and-punctuation"
                      style={[inputStyle, { flex: 1 }]}
                    />
                  </View>
                </View>

                {/* Radius */}
                <View>
                  <Text style={labelStyle}>Radius (meters)</Text>
                  <TextInput
                    placeholder="1609"
                    placeholderTextColor={textMute}
                    value={radius}
                    onChangeText={setRadius}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />
                </View>

                {/* Arrive vs leave */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 4,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 15, color: textColor }}>Notify when leaving</Text>
                    <Text style={{ fontSize: 12, color: textMute, marginTop: 2 }}>
                      Off = notify on arrival
                    </Text>
                  </View>
                  <Switch
                    value={onLeave}
                    onValueChange={setOnLeave}
                    trackColor={{ true: accent }}
                  />
                </View>

                <Text style={{ fontSize: 12, color: textMute, lineHeight: 17 }}>
                  Place reminders fire on this device via geofencing. They need location permission
                  set to “Always”.
                </Text>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
