import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearToken, getUserEmail } from "@/lib/auth";

interface MenuDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function MenuDrawer({ visible, onClose }: MenuDrawerProps) {
  const dark = useColorScheme() === "dark";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";

  useEffect(() => {
    if (visible) getUserEmail().then(setEmail);
  }, [visible]);

  const initials = email ? email[0].toUpperCase() : "?";
  const displayName = email ?? "Account";

  function go(path: string) {
    onClose();
    router.push(path as "/");
  }

  async function handleLogout() {
    onClose();
    await clearToken();
    router.replace("/login");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose}>
        {/* Inner Pressable absorbs taps on the drawer so they don't close the modal */}
        <Pressable
          onPress={() => {}}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 300,
            maxWidth: "85%",
            backgroundColor: bg,
            paddingTop: insets.top + 16,
            borderRightWidth: 1,
            borderRightColor: border,
          }}
        >
          {/* Account header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 18,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#5c7cfa",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: textColor }} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={{ fontSize: 12, color: textMute, marginTop: 1 }}>Signed in</Text>
            </View>
          </View>

          {/* Menu items */}
          <View style={{ paddingVertical: 8 }}>
            <Pressable
              onPress={() => go("/reminders")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 18,
                paddingVertical: 14,
                backgroundColor: pressed ? (dark ? "#25262b" : "#f8f9fa") : "transparent",
              })}
            >
              <Feather name="bell" size={18} color={textMute} />
              <Text style={{ fontSize: 15, color: textColor }}>Reminders</Text>
            </Pressable>

            <Pressable
              onPress={() => go("/settings")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 18,
                paddingVertical: 14,
                backgroundColor: pressed ? (dark ? "#25262b" : "#f8f9fa") : "transparent",
              })}
            >
              <Feather name="settings" size={18} color={textMute} />
              <Text style={{ fontSize: 15, color: textColor }}>Settings</Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 18,
                paddingVertical: 14,
                backgroundColor: pressed ? (dark ? "#25262b" : "#f8f9fa") : "transparent",
              })}
            >
              <Feather name="log-out" size={18} color="#e03131" />
              <Text style={{ fontSize: 15, color: "#e03131" }}>Log out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
