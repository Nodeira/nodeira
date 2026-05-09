import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Text } from "@mantine/core";
import { pluginRegistry, pluginRegistryVersionAtom } from "../../../lib/pluginRegistry.js";

export const Route = createFileRoute("/_authenticated/plugins/$pluginId")({
  component: PluginPage,
});

function PluginPage() {
  const { pluginId } = Route.useParams();
  useAtomValue(pluginRegistryVersionAtom);

  const pageDef = pluginRegistry.getPages().find((p) => p.pluginId === pluginId);

  if (!pageDef) {
    return (
      <Text c="dimmed" size="sm" fs="italic">
        Plugin &ldquo;{pluginId}&rdquo; is not loaded or does not provide a page.
      </Text>
    );
  }

  const Comp = pageDef.component;
  return <Comp />;
}
