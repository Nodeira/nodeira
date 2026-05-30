import { createFileRoute } from "@tanstack/react-router";
import { Box, Title, Text, Group } from "@mantine/core";
import { GraphView } from "../../components/GraphView.js";

export const Route = createFileRoute("/_authenticated/graph")({
  component: GraphPage,
});

function GraphPage() {
  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Group
        px="md"
        py="xs"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Title order={5} style={{ fontWeight: 600 }}>Graph View</Title>
        <Text size="xs" c="dimmed">Click a node to open the note</Text>
      </Group>
      <Box style={{ flex: 1, minHeight: 0 }}>
        <GraphView />
      </Box>
    </Box>
  );
}
