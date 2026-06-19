import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View, useColorScheme } from "react-native";

import { clearToken } from "@/lib/auth";

interface ErrorStateProps {
  onRetry: () => void;
  /** Optional override for the headline (defaults to "Failed to load notes"). */
  title?: string;
}

/**
 * Full-screen error/escape hatch shown when a screen's data query fails.
 * Critically, this gives the user a way OUT (Settings / Sign out) even on
 * screens reached via router.replace, where the back button has nothing to pop.
 */
export function ErrorState({ onRetry, title = "Failed to load notes" }: ErrorStateProps) {
  const router = useRouter();
  const dark = useColorScheme() === "dark";

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: bg,
        paddingHorizontal: 24,
        gap: 12,
      }}
    >
      <Feather name="wifi-off" size={28} color="#e03131" />
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#e03131" }}>{title}</Text>
      <Text style={{ fontSize: 13, color: textMute, textAlign: "center" }}>
        Couldn&apos;t reach your Nodeira server. Check the Server URL in Settings, or sign in again
        if your session expired. On a physical device use your machine&apos;s address, not
        localhost.
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 24,
          borderRadius: 8,
          backgroundColor: "#4263eb",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Retry</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/settings")}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 24,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: border,
        }}
      >
        <Text style={{ color: textColor, fontSize: 14 }}>Open Settings</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          await clearToken();
          router.replace("/login");
        }}
        style={{ paddingVertical: 10, paddingHorizontal: 24 }}
      >
        <Text style={{ color: "#e03131", fontSize: 13 }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
