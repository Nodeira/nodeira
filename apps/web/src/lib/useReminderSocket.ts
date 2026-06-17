import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconBell } from "@tabler/icons-react";
import { createElement } from "react";
import type { ReminderNotification } from "@nodeira/shared-types";
import { authStorage } from "./authStorage.js";
import { registerDevice, remindersKeys } from "./api.js";
import "./electronAPI.js";

function notificationsWsUrl(token: string): string {
  // Desktop talks directly to the API; the web dev/prod server proxies /notifications.
  const apiBase = window.electronAPI?.apiBaseUrl;
  const base = apiBase ?? window.location.origin;
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/notifications?token=${encodeURIComponent(token)}`;
}

/**
 * Subscribes to the reminders WebSocket and surfaces fired reminders as toasts.
 * Also registers this browser as a (WS-only) device so it shows up in the user's
 * device list. Mounted once from the authenticated AppShell.
 */
export function useReminderSocket(): void {
  const qc = useQueryClient();

  // Register this browser as a web device (WS delivery, no push token).
  useEffect(() => {
    if (!authStorage.getToken()) return;
    const platform = window.electronAPI ? "desktop" : "web";
    void registerDevice({ platform, name: navigator.userAgent.slice(0, 80) }).catch(() => {
      /* non-fatal: device registration is best-effort */
    });
  }, []);

  // Maintain the notifications WebSocket with simple reconnect.
  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(notificationsWsUrl(token));

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: ReminderNotification;
          };
          if (msg.type !== "reminder") return;
          const { title, body } = msg.payload;
          // On desktop, fire a native OS notification (visible even from the tray);
          // otherwise fall back to an in-app Mantine toast.
          const showNative = window.electronAPI?.showNotification;
          if (showNative) {
            void showNative({ title, ...(body ? { body } : {}) });
          } else {
            notifications.show({
              title,
              message: body ?? "",
              color: "blue",
              icon: createElement(IconBell, { size: 16 }),
              autoClose: 8000,
            });
          }
          void qc.invalidateQueries({ queryKey: remindersKeys.all });
        } catch {
          /* ignore malformed messages */
        }
      };

      socket.onclose = () => {
        if (closed) return;
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [qc]);
}
