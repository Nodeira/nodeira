import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@mantine/core";

export const Route = createFileRoute("/")({
  component: NotesIndex,
});

function NotesIndex() {
  return (
    <Text c="dimmed" size="sm">
      Select a note from the sidebar to start editing.
    </Text>
  );
}
