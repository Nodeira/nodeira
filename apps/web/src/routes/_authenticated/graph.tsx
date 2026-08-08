import { createFileRoute } from "@tanstack/react-router";
import { Box, Title, Text, Group } from "@mantine/core";
import { lazy, Suspense } from "react";
import { Loader, Center } from "@mantine/core";

// react-force-graph-2d pulls in a canvas rendering stack that nothing else needs. Loading
// it with the route keeps it out of the initial bundle.
const GraphView = lazy(() =>
  import("../../components/GraphView.js").then((m) => ({ default: m.GraphView })),
);

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
        <Title order={5} style={{ fontWeight: 600 }}>
          Graph View
        </Title>
        <Text size="xs" c="dimmed">
          Click a node to open the note
        </Text>
      </Group>
      <Box style={{ flex: 1, minHeight: 0 }}>
        <Suspense
          fallback={
            <Center h="100%">
              <Loader size="sm" />
            </Center>
          }
        >
          <GraphView />
        </Suspense>
      </Box>
    </Box>
  );
}
