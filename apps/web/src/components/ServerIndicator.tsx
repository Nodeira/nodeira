import { useState } from "react";
import { IconServer, IconServerOff } from "@tabler/icons-react";
import { Badge, Button, Popover, Stack, Text, TextInput } from "@mantine/core";
import { useAtomValue } from "jotai";
import { networkStatusAtom } from "../store/networkStatusAtom.js";
import "../lib/electronAPI.js";

/** Parse "http://localhost:3001" → "localhost:3001" for a compact badge label. */
function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Desktop-only header indicator showing which Nodeira server the app is
 * connected to. Clicking opens a popover to view the full URL and switch
 * servers inline. Renders nothing in the browser build (no electronAPI).
 */
export function ServerIndicator() {
  const electronAPI = typeof window !== "undefined" ? window.electronAPI : undefined;
  const apiBaseUrl = electronAPI?.apiBaseUrl ?? "";
  const networkStatus = useAtomValue(networkStatusAtom);

  const [opened, setOpened] = useState(false);
  const [url, setUrl] = useState(apiBaseUrl);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Browser build (no Electron) or no URL configured (connect screen handles that)
  if (!electronAPI || !apiBaseUrl) return null;

  const online = networkStatus === "online";

  async function handleSave() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Server URL is required");
      return;
    }
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError("Enter a valid URL starting with http:// or https://");
      return;
    }
    setError("");
    setLoading(true);
    // Persists to SQLite and reloads the window — loading resolves on reload
    await electronAPI!.settings.setServerUrl(trimmed);
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={320}
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <Badge
          component="button"
          type="button"
          onClick={() => setOpened((o) => !o)}
          color={online ? "teal" : "gray"}
          variant="light"
          size="sm"
          style={{ cursor: "pointer" }}
          leftSection={online ? <IconServer size={11} /> : <IconServerOff size={11} />}
        >
          {hostLabel(apiBaseUrl)}
        </Badge>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <div>
            <Text size="xs" c="dimmed">
              {online ? "Connected to" : "Configured server (offline)"}
            </Text>
            <Text size="sm" fw={600} style={{ wordBreak: "break-all" }}>
              {apiBaseUrl}
            </Text>
          </div>
          <TextInput
            label="Switch server"
            placeholder="http://localhost:3001"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
            error={error}
            size="sm"
          />
          <Button
            size="sm"
            loading={loading}
            disabled={url.trim() === apiBaseUrl}
            onClick={() => void handleSave()}
            fullWidth
          >
            Save &amp; Reconnect
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
