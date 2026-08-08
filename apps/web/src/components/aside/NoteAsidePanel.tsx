import { lazy, Suspense, useState } from "react";
import { IconBell, IconMaximize, IconMinimize } from "@tabler/icons-react";
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure, useResizeObserver } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Link } from "@tanstack/react-router";
import { noteKindRegistry, TASK_STATUSES } from "../../lib/noteKindRegistry.js";
import { pluginRegistry, pluginRegistryVersionAtom } from "../../lib/pluginRegistry.js";
import {
  backlinksKeys,
  createReminder,
  getBacklinks,
  remindersKeys,
  type CreateReminderBody,
} from "../../lib/api.js";
import type { Folder, NoteMetadata } from "@nodeira/shared-types";
// Same force-graph stack as the /graph route; only mounted when the panel is open.
const LocalGraph = lazy(() => import("./LocalGraph.js").then((m) => ({ default: m.LocalGraph })));
import { ReminderModal } from "../modals/ReminderModal.js";

export function NoteAsidePanel({
  note,
  folders,
  onKindChange,
  onStatusChange,
  onFullscreen,
  isFullscreen,
}: {
  note: NoteMetadata | null;
  folders: Folder[];
  onKindChange: (id: string, kind: string | null) => void;
  onStatusChange: (id: string, status: string) => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}) {
  const [propertiesOpen, setPropertiesOpen] = useDisclosure(true);
  const [graphOpen, setGraphOpen] = useDisclosure(true);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [graphRef, graphRect] = useResizeObserver<HTMLDivElement>();
  useAtomValue(pluginRegistryVersionAtom);
  const asideSections = pluginRegistry.getAsideSections();
  const qc = useQueryClient();

  const createReminderMutation = useMutation({
    mutationFn: (body: CreateReminderBody) => createReminder(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: remindersKeys.all });
      setReminderOpen(false);
      notifications.show({ message: "Reminder set", color: "blue" });
    },
    onError: () => notifications.show({ message: "Couldn't create reminder", color: "red" }),
  });

  const { data: backlinks = [] } = useQuery({
    queryKey: backlinksKeys.forNote(note?.id ?? ""),
    queryFn: () => getBacklinks(note!.id),
    enabled: !!note,
  });

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
        {note && (
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconBell size={13} />}
            mr="auto"
            onClick={() => setReminderOpen(true)}
          >
            Add reminder
          </Button>
        )}
        <ActionIcon
          size="xs"
          variant="subtle"
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          onClick={onFullscreen}
        >
          {isFullscreen ? <IconMinimize size={13} /> : <IconMaximize size={13} />}
        </ActionIcon>
      </Group>

      {note && (
        <ReminderModal
          opened={reminderOpen}
          onClose={() => setReminderOpen(false)}
          onSubmit={(body) => createReminderMutation.mutate(body)}
          submitting={createReminderMutation.isPending}
          target={{ targetType: "NOTE", targetNoteId: note.id, label: note.title || "Untitled" }}
        />
      )}

      {/* Local graph */}
      <Box>
        <Group
          justify="space-between"
          px="md"
          py={6}
          style={{
            cursor: "pointer",
            borderBottom: "1px solid var(--mantine-color-default-border)",
          }}
          onClick={setGraphOpen.toggle}
        >
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
            Local Graph
          </Text>
          <Text size="xs" c="dimmed">
            {graphOpen ? "▾" : "▸"}
          </Text>
        </Group>
        <Collapse expanded={graphOpen}>
          <Box ref={graphRef} style={{ overflow: "hidden" }}>
            {note && graphRect.width > 0 ? (
              <Suspense fallback={null}>
                <LocalGraph note={note} width={graphRect.width} />
              </Suspense>
            ) : (
              <Box
                h={220}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Text size="xs" c="dimmed" fs="italic">
                  Open a note to see its graph
                </Text>
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>

      <Divider />

      <Box p="md" pb="xs">
        <Text
          size="xs"
          fw={600}
          tt="uppercase"
          c="dimmed"
          style={{ letterSpacing: "0.08em" }}
          mb="xs"
        >
          Backlinks · {backlinks.length}
        </Text>
        {note ? (
          backlinks.length > 0 ? (
            <Stack gap={2}>
              {backlinks.map((bl) => (
                <Link
                  key={bl.id}
                  to="/notes/$noteId"
                  params={{ noteId: bl.id }}
                  style={{ textDecoration: "none" }}
                >
                  <Text
                    size="xs"
                    c="blue"
                    style={{
                      textDecoration: "underline",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bl.title || "Untitled"}
                  </Text>
                </Link>
              ))}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed" fs="italic">
              No backlinks yet.{" "}
              <Text span size="xs" ff="monospace" c="dimmed">
                [[link to this note]]
              </Text>
            </Text>
          )
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
                      if (v) onStatusChange(note.id, v);
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

      {/* Plugin aside sections */}
      {asideSections.map((section) => {
        const Comp = section.component;
        return (
          <div key={section.id}>
            <Divider />
            <Comp note={note} />
          </div>
        );
      })}
    </Stack>
  );
}
