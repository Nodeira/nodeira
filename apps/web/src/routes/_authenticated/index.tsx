import { createFileRoute, redirect } from "@tanstack/react-router";
import { Text } from "@mantine/core";
import { getUserPreferences } from "../../lib/api.js";

// Only redirect once per browser session so navigating back to "/" always works.
let _startupRedirectDone = false;

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    if (_startupRedirectDone) return;
    _startupRedirectDone = true;

    let view: string | undefined;
    try {
      const prefs = await getUserPreferences();
      view = prefs.startupView;
    } catch {
      return;
    }

    if (!view || view === "home") return;
    if (view === "quick-notes") throw redirect({ to: "/quick-notes" });
    if (view === "graph") throw redirect({ to: "/graph" });
    if (view.startsWith("plugin:")) {
      throw redirect({ to: "/plugins/$pluginId", params: { pluginId: view.slice(7) } });
    }
  },
  component: NotesIndex,
});

function NotesIndex() {
  return (
    <Text c="dimmed" size="sm">
      Select a note from the sidebar to start editing.
    </Text>
  );
}
