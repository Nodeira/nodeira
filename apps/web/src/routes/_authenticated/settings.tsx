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
  const [url, setUrl] = useState(window.electronAPI?.apiBaseUrl ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    await window.electronAPI!.settings.setServerUrl(trimmed);
  }

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
        onClick={() => void handleSave()}
        style={{ alignSelf: "flex-start" }}
      >
        Save &amp; Reconnect
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
