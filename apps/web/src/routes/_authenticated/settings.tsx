import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Code,
  Group,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useAtomValue } from "jotai";
import {
  getPlugins,
  getUserPreferences,
  installPlugin,
  patchUserPreferences,
  pluginsKeys,
  setPluginEnabled,
  uninstallPlugin,
  userPreferencesKeys,
} from "../../lib/api.js";
import { loadPlugin } from "../../lib/pluginLoader.js";
import { pluginRegistry, pluginRegistryVersionAtom } from "../../lib/pluginRegistry.js";
import type { Keybinds } from "../../lib/electronAPI.js";
import { useServerUrlForm } from "../../lib/useServerUrlForm.js";
import { SharingTab } from "../../components/settings/SharingTab.js";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const isElectron = typeof window !== "undefined" && window.electronAPI !== undefined;
  return (
    <Stack gap="md">
      <Title order={3}>Settings</Title>
      <Tabs defaultValue="general">
        <Tabs.List>
          <Tabs.Tab value="general">General</Tabs.Tab>
          {isElectron && <Tabs.Tab value="connection">Connection</Tabs.Tab>}
          {isElectron && <Tabs.Tab value="keybinds">Keybinds</Tabs.Tab>}
          <Tabs.Tab value="sharing">Sharing</Tabs.Tab>
          <Tabs.Tab value="plugins">Plugins</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="general" pt="md">
          <GeneralTab />
        </Tabs.Panel>
        {isElectron && (
          <Tabs.Panel value="connection" pt="md">
            <ConnectionTab />
          </Tabs.Panel>
        )}
        {isElectron && (
          <Tabs.Panel value="keybinds" pt="md">
            <KeybindsTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="sharing" pt="md">
          <SharingTab />
        </Tabs.Panel>
        <Tabs.Panel value="plugins" pt="md">
          <PluginsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

const BUILTIN_STARTUP_VIEWS = [
  { value: "home", label: "Home" },
  { value: "quick-notes", label: "Quick Notes" },
  { value: "graph", label: "Graph" },
];

function GeneralTab() {
  const qc = useQueryClient();
  // Re-derive options when plugins register new pages
  useAtomValue(pluginRegistryVersionAtom);

  const { data: prefs } = useQuery({
    queryKey: userPreferencesKeys.me,
    queryFn: getUserPreferences,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (startupView: string) => patchUserPreferences({ startupView }),
    onSuccess: (updated) => qc.setQueryData(userPreferencesKeys.me, updated),
  });

  const pluginOptions = pluginRegistry
    .getPages()
    .map((p) => ({ value: `plugin:${p.pluginId}`, label: p.label }));

  const startupViewOptions = [...BUILTIN_STARTUP_VIEWS, ...pluginOptions];

  return (
    <Stack gap="md" style={{ maxWidth: 500 }}>
      <Select
        label="Startup View"
        description="Which view opens when the app first loads."
        data={startupViewOptions}
        value={prefs?.startupView ?? "home"}
        onChange={(v) => v && mutation.mutate(v)}
      />
    </Stack>
  );
}

function ConnectionTab() {
  const { url, setUrl, error, loading, save } = useServerUrlForm(
    window.electronAPI?.apiBaseUrl ?? "",
  );

  return (
    <Stack gap="md" style={{ maxWidth: 500 }}>
      <TextInput
        label="Server URL"
        description="The URL of your Nodeira server. The app will reload when you save."
        placeholder="http://localhost:3001"
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        error={error}
      />
      <Button
        loading={loading}
        disabled={url.trim() === (window.electronAPI?.apiBaseUrl ?? "")}
        onClick={() => void save()}
        style={{ alignSelf: "flex-start" }}
      >
        Save &amp; Reconnect
      </Button>
    </Stack>
  );
}

// ── Keybinds ──────────────────────────────────────────────────────────────────

const isMac =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);

const KEYBIND_FIELDS: { action: keyof Keybinds; label: string; description: string }[] = [
  {
    action: "newNote",
    label: "New note",
    description: "Create a new note and bring Nodeira to the front.",
  },
  {
    action: "newQuickNote",
    label: "New quick note",
    description: "Create a quick note from anywhere and focus the window.",
  },
];

// Translates a browser keydown into an Electron accelerator string, e.g.
// "CommandOrControl+Shift+N". Returns null until a non-modifier key is pressed
// alongside at least one modifier (global shortcuts need a modifier).
function eventToAccelerator(e: React.KeyboardEvent): string | null {
  const key = e.key;
  if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (parts.length === 0) return null; // require a modifier

  const ARROWS: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };
  let main: string;
  if (key === " ") main = "Space";
  else if (/^f\d{1,2}$/i.test(key)) main = key.toUpperCase();
  else if (key.length === 1) main = key.toUpperCase();
  else if (ARROWS[key]) main = ARROWS[key];
  else if (key === "Enter") main = "Return";
  else if (key === "Backspace" || key === "Delete" || key === "Tab" || key === "Escape") main = key;
  else return null;

  parts.push(main);
  return parts.join("+");
}

// Human-readable rendering of an accelerator for the input field.
function acceleratorToLabel(accelerator: string): string {
  if (!accelerator) return "";
  return accelerator
    .split("+")
    .map((part) => (part === "CommandOrControl" ? (isMac ? "⌘" : "Ctrl") : part))
    .join(" + ");
}

function KeybindInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (accelerator: string) => void;
}) {
  const [capturing, setCapturing] = useState(false);

  return (
    <TextInput
      label={label}
      description={description}
      readOnly
      placeholder="Click, then press a shortcut"
      value={capturing ? "Press a shortcut…" : acceleratorToLabel(value)}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={(e) => {
        e.preventDefault();
        if (e.key === "Escape") {
          e.currentTarget.blur();
          return;
        }
        const accelerator = eventToAccelerator(e);
        if (accelerator) {
          onChange(accelerator);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function KeybindsTab() {
  const [keybinds, setKeybinds] = useState<Keybinds>(() =>
    window.electronAPI!.settings.getKeybinds(),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await window.electronAPI!.settings.setKeybinds(keybinds);
    setSaving(false);
    setDirty(false);

    const failed = KEYBIND_FIELDS.filter((f) => !result[f.action]).map((f) => f.label);
    if (failed.length > 0) {
      notifications.show({
        color: "red",
        message: `Couldn't register: ${failed.join(", ")}. The combination may already be in use by another app.`,
      });
    } else {
      notifications.show({ color: "green", message: "Shortcuts updated." });
    }
  }

  return (
    <Stack gap="md" style={{ maxWidth: 500 }}>
      <Text size="sm" c="dimmed">
        Global shortcuts work even when Nodeira is in the background. Click a field and press the
        keys you want.
      </Text>
      {KEYBIND_FIELDS.map((field) => (
        <KeybindInput
          key={field.action}
          label={field.label}
          description={field.description}
          value={keybinds[field.action]}
          onChange={(accelerator) => {
            setKeybinds((prev) => ({ ...prev, [field.action]: accelerator }));
            setDirty(true);
          }}
        />
      ))}
      <Button
        loading={saving}
        disabled={!dirty}
        onClick={() => void handleSave()}
        style={{ alignSelf: "flex-start" }}
      >
        Save Shortcuts
      </Button>
    </Stack>
  );
}

function PluginsTab() {
  const qc = useQueryClient();
  const [installSource, setInstallSource] = useState("");

  const { data: plugins = [] } = useQuery({
    queryKey: pluginsKeys.all,
    queryFn: getPlugins,
  });

  const installMutation = useMutation({
    mutationFn: installPlugin,
    onSuccess: async (plugin) => {
      await qc.invalidateQueries({ queryKey: pluginsKeys.all });
      await loadPlugin(plugin.source);
      setInstallSource("");
    },
    onError: () => notifications.show({ message: "Couldn't install plugin", color: "red" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      setPluginEnabled(pluginId, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginsKeys.all }),
  });

  const removeMutation = useMutation({
    mutationFn: uninstallPlugin,
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginsKeys.all }),
    onError: () => notifications.show({ message: "Couldn't remove plugin", color: "red" }),
  });

  return (
    <Stack gap="md" style={{ maxWidth: 600 }}>
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Install Plugin
        </Text>
        <Text size="xs" c="dimmed">
          Enter a GitHub path: <Code>owner/repo@v1.0.0</Code>
        </Text>
        <Group gap="sm" align="flex-end">
          <TextInput
            placeholder="Nodeira/plugin-journal@v1.0.0"
            value={installSource}
            onChange={(e) => setInstallSource(e.currentTarget.value)}
            style={{ flex: 1 }}
            size="sm"
          />
          <Button
            size="sm"
            loading={installMutation.isPending}
            disabled={!installSource.trim()}
            onClick={() => installMutation.mutate(installSource.trim())}
          >
            Install
          </Button>
        </Group>
        {installMutation.isError && (
          <Text size="xs" c="red">
            Failed to install plugin. Check the source path and try again.
          </Text>
        )}
      </Stack>

      {plugins.length === 0 ? (
        <Text size="sm" c="dimmed" fs="italic">
          No plugins installed.
        </Text>
      ) : (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Installed Plugins
          </Text>
          {plugins.map((plugin) => (
            <Group
              key={plugin.pluginId}
              justify="space-between"
              p="sm"
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 6,
              }}
            >
              <Stack gap={2}>
                <Group gap="xs">
                  <Text size="sm" fw={600}>
                    {plugin.pluginId}
                  </Text>
                  <Badge size="xs" variant="outline" color="gray">
                    {plugin.source}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Installed {plugin.installedAt.toLocaleDateString()}
                </Text>
              </Stack>
              <Group gap="sm">
                <Switch
                  checked={plugin.enabled}
                  onChange={(e) =>
                    toggleMutation.mutate({
                      pluginId: plugin.pluginId,
                      enabled: e.currentTarget.checked,
                    })
                  }
                  size="sm"
                  label={plugin.enabled ? "Enabled" : "Disabled"}
                />
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  loading={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(plugin.pluginId)}
                >
                  Remove
                </Button>
              </Group>
            </Group>
          ))}
          <Text size="xs" c="dimmed">
            Reload the page after disabling a plugin for changes to take effect.
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
