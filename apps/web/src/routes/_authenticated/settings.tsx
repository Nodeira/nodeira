import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Code,
  Group,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  getPlugins,
  installPlugin,
  pluginsKeys,
  setPluginEnabled,
  uninstallPlugin,
} from "../../lib/api.js";
import { loadPlugin } from "../../lib/pluginLoader.js";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Stack gap="md">
      <Title order={3}>Settings</Title>
      <Tabs defaultValue="plugins">
        <Tabs.List>
          <Tabs.Tab value="plugins">Plugins</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plugins" pt="md">
          <PluginsTab />
        </Tabs.Panel>
      </Tabs>
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
  });

  const toggleMutation = useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      setPluginEnabled(pluginId, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginsKeys.all }),
  });

  const removeMutation = useMutation({
    mutationFn: uninstallPlugin,
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginsKeys.all }),
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
