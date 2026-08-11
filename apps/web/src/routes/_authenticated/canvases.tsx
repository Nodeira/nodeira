import { ActionIcon, Box, Button, Card, Group, Menu, SimpleGrid, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDots, IconLayout, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRef, useEffect, useState } from "react";
import { canvasKeys, createCanvas, deleteCanvas, getCanvases } from "../../lib/api.js";
import { useActiveVaultId } from "../../lib/useActiveVaultId.js";
import { currentVaultAtom } from "../../store/atoms.js";
import { CanvasPreview } from "../../components/canvas/CanvasPreview.js";
import type { Canvas, CanvasData } from "@nodeira/shared-types";

export const Route = createFileRoute("/_authenticated/canvases")({
  component: CanvasesPage,
});

function ThumbnailPlaceholder() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconLayout size={32} color="var(--mantine-color-gray-4)" />
    </div>
  );
}

function CanvasThumbnail({ data }: { data: CanvasData }) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setMounted(true);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasNodes = data.nodes.length > 0;

  return (
    <div
      ref={ref}
      style={{
        height: 120,
        background: "var(--mantine-color-gray-0)",
        borderRadius: 4,
        overflow: "hidden",
        pointerEvents: "none",
        position: "relative",
      }}
    >
      {mounted && hasNodes ? (
        // The placeholder doubles as the Suspense fallback: the thumbnail already renders it
        // until the card scrolls into view, so the renderer chunk loading looks like more of
        // the same rather than a new spinner.
        <CanvasPreview data={data} fallback={<ThumbnailPlaceholder />} />
      ) : (
        <ThumbnailPlaceholder />
      )}
    </div>
  );
}

function CanvasCard({ canvas, onDelete }: { canvas: Canvas; onDelete: () => void }) {
  const navigate = useNavigate();

  return (
    <Card
      shadow="xs"
      padding="sm"
      radius="md"
      withBorder
      style={{ cursor: "pointer" }}
      onClick={() => void navigate({ to: "/canvas/$canvasId", params: { canvasId: canvas.id } })}
    >
      <CanvasThumbnail data={canvas.data} />
      <Group justify="space-between" mt="xs" gap="xs">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} lineClamp={1}>
            {canvas.icon ? `${canvas.icon} ` : ""}
            {canvas.title}
          </Text>
          <Text size="xs" c="dimmed">
            {new Date(canvas.updatedAt).toLocaleDateString()}
          </Text>
        </div>
        <Menu withinPortal position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm" onClick={(e) => e.stopPropagation()}>
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}

function CanvasesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentVault = useAtomValue(currentVaultAtom);
  const activeVaultId = useActiveVaultId();

  const { data: canvases = [], isLoading } = useQuery({
    queryKey: canvasKeys.all,
    queryFn: () => getCanvases(currentVault ? { vaultId: currentVault } : {}),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!activeVaultId) throw new Error("No vault available");
      return createCanvas({ vaultId: activeVaultId });
    },
    onSuccess: (canvas) => {
      void queryClient.invalidateQueries({ queryKey: canvasKeys.all });
      void navigate({ to: "/canvas/$canvasId", params: { canvasId: canvas.id } });
    },
    onError: () => notifications.show({ message: "Couldn't create canvas", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCanvas,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: canvasKeys.all });
      notifications.show({ message: "Canvas deleted", color: "red" });
    },
    onError: () => notifications.show({ message: "Couldn't delete canvas", color: "red" }),
  });

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Group
        px="md"
        py="xs"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
        justify="space-between"
      >
        <Title order={5} style={{ fontWeight: 600 }}>
          Canvases
        </Title>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => createMutation.mutate()}
          loading={createMutation.isPending}
        >
          New Canvas
        </Button>
      </Group>

      <Box p="md" style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? (
          <Text c="dimmed" size="sm">
            Loading…
          </Text>
        ) : canvases.length === 0 ? (
          <Box ta="center" py="xl">
            <IconLayout size={48} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed" mt="sm">
              No canvases yet. Create one to get started.
            </Text>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {canvases.map((canvas) => (
              <CanvasCard
                key={canvas.id}
                canvas={canvas}
                onDelete={() => deleteMutation.mutate(canvas.id)}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
}
