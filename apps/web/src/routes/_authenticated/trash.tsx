import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAtomValue } from "jotai";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconFileText,
  IconFolder,
  IconLayoutDashboard,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";
import {
  canvasKeys,
  foldersKeys,
  getTrash,
  notesKeys,
  purgeTrashItem,
  restoreTrashItem,
  trashKeys,
  type TrashItem,
} from "../../lib/api.js";
import { usePurgeNote } from "../../lib/usePurgeNote.js";
import { currentVaultAtom } from "../../store/atoms.js";
import {
  DeleteConfirmModal,
  type DeleteTarget,
} from "../../components/modals/DeleteConfirmModal.js";

export const Route = createFileRoute("/_authenticated/trash")({
  component: TrashPage,
});

const TYPE_ICON: Record<TrashItem["type"], typeof IconFileText> = {
  note: IconFileText,
  folder: IconFolder,
  canvas: IconLayoutDashboard,
};

/** invalidates the query keys a trash mutation for `type` needs to refresh besides trashKeys itself */
function entityKeysFor(type: TrashItem["type"]) {
  switch (type) {
    case "note":
      return notesKeys.all;
    case "folder":
      return foldersKeys.all;
    case "canvas":
      return canvasKeys.all;
  }
}

function relativeDays(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function TrashPage() {
  const qc = useQueryClient();
  const currentVaultId = useAtomValue(currentVaultAtom);
  const [purgeTarget, setPurgeTarget] = useState<DeleteTarget | null>(null);

  const queryKey = currentVaultId ? trashKeys.byVault(currentVaultId) : trashKeys.all;
  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getTrash(currentVaultId ?? undefined),
  });

  const restoreMutation = useMutation({
    mutationFn: (item: TrashItem) => restoreTrashItem(item.type, item.id),
    onSuccess: (_result, item) => {
      qc.invalidateQueries({ queryKey: trashKeys.all });
      qc.invalidateQueries({ queryKey: entityKeysFor(item.type) });
    },
    onError: () => notifications.show({ message: "Couldn't restore item", color: "red" }),
  });

  const purgeNoteMutation = usePurgeNote();
  const purgeOtherMutation = useMutation({
    mutationFn: ({ type, id }: { type: TrashItem["type"]; id: string }) => purgeTrashItem(type, id),
    onSuccess: (_result, { type }) => {
      qc.invalidateQueries({ queryKey: trashKeys.all });
      qc.invalidateQueries({ queryKey: entityKeysFor(type) });
    },
    onError: () => notifications.show({ message: "Couldn't delete item", color: "red" }),
  });

  function confirmPurge() {
    if (!purgeTarget) return;
    const type = purgeTarget.type as TrashItem["type"];
    if (type === "note") {
      purgeNoteMutation.mutate(purgeTarget.id);
    } else {
      purgeOtherMutation.mutate({ type, id: purgeTarget.id });
    }
    setPurgeTarget(null);
  }

  const sorted = [...items].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Group
        px="md"
        py="xs"
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Group gap={8}>
          <IconTrash size={18} />
          <Title order={5} style={{ fontWeight: 600 }}>
            Trash
          </Title>
          <Text size="xs" c="dimmed">
            {sorted.length} item{sorted.length === 1 ? "" : "s"}
          </Text>
        </Group>
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        <Stack gap="xs" p="md" maw={680}>
          {!isLoading && sorted.length === 0 && (
            <Text size="sm" c="dimmed">
              Trash is empty. Deleted notes, folders, and canvases stay here for 30 days before
              they're permanently removed.
            </Text>
          )}
          {sorted.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <Paper key={`${item.type}-${item.id}`} withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Icon size={16} />
                    <Box style={{ minWidth: 0 }}>
                      <Group gap={6} wrap="nowrap">
                        <Text fw={600} size="sm" truncate>
                          {item.title || "Untitled"}
                        </Text>
                        {item.itemCount !== undefined && (
                          <Badge size="xs" variant="light" color="gray">
                            {item.itemCount} item{item.itemCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        Deleted {relativeDays(item.deletedAt)}
                      </Text>
                    </Box>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="Restore">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => restoreMutation.mutate(item)}
                      >
                        <IconRestore size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete forever">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() =>
                          setPurgeTarget({ type: item.type, id: item.id, name: item.title })
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>

      <DeleteConfirmModal
        target={purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={confirmPurge}
        permanent
      />
    </Box>
  );
}
