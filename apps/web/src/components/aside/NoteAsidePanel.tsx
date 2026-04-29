import { IconMaximize, IconMinimize } from "@tabler/icons-react";
import { ActionIcon, Box, Collapse, Divider, Group, Select, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { noteKindRegistry, TASK_STATUSES } from "../../lib/noteKindRegistry.js";
import type { Folder, NoteMetadata } from "@nodeira/shared-types";

export function NoteAsidePanel({
  note,
  folders,
  onKindChange,
  onFullscreen,
  isFullscreen,
}: {
  note: NoteMetadata | null;
  folders: Folder[];
  onKindChange: (id: string, kind: string | null) => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}) {
  const [propertiesOpen, setPropertiesOpen] = useDisclosure(true);

  const folderName = note?.folderId
    ? (folders.find((f) => f.id === note.folderId)?.name ?? "—")
    : "—";

  const kindDef = noteKindRegistry.get(note?.kind ?? null);
  const taskStatus =
    note?.kind === "task" ? (note.kindMeta?.status as string | undefined) : undefined;

  return (
    <Stack gap={0} h="100%">
      <Group
        justify="flex-end"
        px="xs"
        py={4}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
      >
        <ActionIcon
          size="xs"
          variant="subtle"
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          onClick={onFullscreen}
        >
          {isFullscreen ? <IconMinimize size={13} /> : <IconMaximize size={13} />}
        </ActionIcon>
      </Group>

      <Box p="md" pb="xs">
        <Text
          size="xs"
          fw={600}
          tt="uppercase"
          c="dimmed"
          style={{ letterSpacing: "0.08em" }}
          mb="xs"
        >
          Backlinks · 0
        </Text>
        {note ? (
          <Text size="xs" c="dimmed" fs="italic">
            No backlinks yet.{" "}
            <Text span size="xs" ff="monospace" c="dimmed">
              [[link to this note]]
            </Text>
          </Text>
        ) : (
          <Text size="xs" c="dimmed" fs="italic">
            Open a note to see backlinks
          </Text>
        )}
      </Box>

      <Divider />

      <Box p="md" pb="xs">
        <Group
          justify="space-between"
          style={{ cursor: "pointer" }}
          onClick={setPropertiesOpen.toggle}
          mb={propertiesOpen ? "xs" : 0}
        >
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
            Properties
          </Text>
          <Text size="xs" c="dimmed">
            {propertiesOpen ? "▾" : "▸"}
          </Text>
        </Group>
        <Collapse expanded={propertiesOpen}>
          {note ? (
            <Stack gap={4}>
              {[
                ["folder", folderName],
                ["created", new Date(note.createdAt).toLocaleDateString()],
                ["updated", new Date(note.updatedAt).toLocaleDateString()],
              ].map(([k, v]) => (
                <Group key={k} gap={8} wrap="nowrap" align="flex-start">
                  <Text size="xs" c="dimmed" ff="monospace" style={{ width: 56, flexShrink: 0 }}>
                    {k}
                  </Text>
                  <Text size="xs" style={{ flex: 1, wordBreak: "break-all" }}>
                    {v}
                  </Text>
                </Group>
              ))}
              <Group gap={8} wrap="nowrap" align="center">
                <Text size="xs" c="dimmed" ff="monospace" style={{ width: 56, flexShrink: 0 }}>
                  kind
                </Text>
                <Select
                  size="xs"
                  value={note.kind ?? "__plain__"}
                  data={noteKindRegistry.getAll().map((def) => ({
                    value: def.id ?? "__plain__",
                    label: def.displayName,
                  }))}
                  onChange={(v) => onKindChange(note.id, v === "__plain__" ? null : (v ?? null))}
                  styles={{ input: { fontSize: 11 }, wrapper: { flex: 1 } }}
                  allowDeselect={false}
                />
              </Group>
              {taskStatus !== undefined && (
                <Group gap={8} wrap="nowrap" align="center">
                  <Text size="xs" c="dimmed" ff="monospace" style={{ width: 56, flexShrink: 0 }}>
                    status
                  </Text>
                  <Select
                    size="xs"
                    value={taskStatus}
                    data={TASK_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
                    onChange={(v) => {
                      if (v) onKindChange(note.id, "task");
                    }}
                    styles={{ input: { fontSize: 11 }, wrapper: { flex: 1 } }}
                    allowDeselect={false}
                  />
                </Group>
              )}
              {kindDef && (
                <Group gap={8} wrap="nowrap" align="flex-start">
                  <Text size="xs" c="dimmed" ff="monospace" style={{ width: 56, flexShrink: 0 }}>
                    type
                  </Text>
                  <Text size="xs">{note.type}</Text>
                </Group>
              )}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed" fs="italic">
              Open a note to see properties
            </Text>
          )}
        </Collapse>
      </Box>
    </Stack>
  );
}
