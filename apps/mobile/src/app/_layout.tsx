import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { Provider as JotaiProvider, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";

import { getToken } from "@/lib/auth";
import { getStartupView, initServerUrl } from "@/lib/config";
import { networkStatusAtom } from "@/store/atoms";
import { OfflineBanner } from "@/components/OfflineBanner";
// Importing this module registers the geofence task + notification handler at startup.
import { registerForPushAsync } from "@/lib/notifications";

const queryClient = new QueryClient();

function NetInfoSync() {
  const setNetworkStatus = useSetAtom(networkStatusAtom);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkStatus(state.isConnected ? "online" : "offline");
    });
    return unsubscribe;
  }, [setNetworkStatus]);
  return null;
}

// Navigate to startup view only once per session after the initial auth check.
let _startupNavigated = false;

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    Promise.all([initServerUrl(), getToken(), getStartupView()]).then(([, token, startupView]) => {
      const inAuthGroup = segments[0] === "login";
      if (token) void registerForPushAsync().catch(() => undefined);
      if (!token && !inAuthGroup) {
        router.replace("/login");
      } else if (token && inAuthGroup) {
        const dest = startupViewToPath(startupView);
        router.replace(dest as "/");
        _startupNavigated = true;
      } else if (token && !_startupNavigated) {
        _startupNavigated = true;
        const dest = startupViewToPath(startupView);
        if (dest !== "/") router.replace(dest as "/");
      }
      setChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  if (!checked) return null;
  return null;
}

function startupViewToPath(view: string): string {
  if (view === "quick-notes") return "/quick-notes";
  if (view === "recents") return "/recents";
  return "/";
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <JotaiProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
              <NetInfoSync />
              <OfflineBanner />
              <AuthGuard />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="index" />
                <Stack.Screen name="recents" />
                <Stack.Screen name="quick-notes" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="note/[id]" />
                <Stack.Screen name="canvases" />
                <Stack.Screen name="canvas/[id]" />
                <Stack.Screen name="reminders" />
              </Stack>
            </ThemeProvider>
          </QueryClientProvider>
        </JotaiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
