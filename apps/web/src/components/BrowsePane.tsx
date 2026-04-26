import { useAtom } from "jotai";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  ActionIcon,
  Badge,
  Group,
  Menu,
  ScrollArea,
  Select,
  Text,
} from "@mantine/core";
import { browsePaneViewAtom, currentVaultAtom } from "../store/atoms.js";
import { getNotes, notesKeys, updateNoteKind } from "../lib/api.js";
import { TASK_STATUSES, noteKindRegistry } from "../lib/noteKindRegistry.js";
import type { NoteMetadata } from "@nodeira/shared-types";

// ── Shared note card ──────────────────────────────────────────────────────────

function BrowseNoteCard({
  note,
  isActive,
  onNavigate,
  onStatusChange,
}: {
  note: NoteMetadata;
  isActive: boolean;
  onNavigate: () => void;
  onStatusChange?: (status: string) => void;
}) {
  const status = note.kind === "task" ? (note.kindMeta?.status as string | undefined) : undefined;
  const statusLabel = TASK_STATUSES.find((s) => s.id === status)?.label;

  return (
    <div
      onClick={onNavigate}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLDivElement).style.background =
            "var(--mantine-color-default-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--mantine-color-default-border)",
        borderLeft: isActive
          ? "2px solid var(--mantine-primary-color-filled)"
          : "2px solid transparent",
        background: isActive ? "var(--mantine-color-default-hover)" : "transparent",
        cursor: "pointer",
      }}
    >
      <Text
        size="sm"
        fw={600}
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: isActive
            ? "var(--mantine-primary-color-filled)"
            : "var(--mantine-color-text)",
        }}
      >
        {note.title || "Untitled"}
      </Text>
      <Group gap={6} mt={4} wrap="nowrap">
        <Text size="xs" c="dimmed" ff="monospace" style={{ flex: 1 }}>
          {new Date(note.updatedAt).toLocaleDateString()}
        </Text>
        {status && onStatusChange && (
          <Select
            size="xs"
            value={status}
            data={TASK_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(v) => { if (v) { onStatusChange(v); } }}
            onClick={(e) => e.stopPropagation()}
            styles={{ input: { fontSize: 10, padding: "0 6px", height: 20, minHeight: 20 }, wrapper: { width: 90 } }}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
        )}
        {status && !onStatusChange && statusLabel && (
          <Badge size="xs" variant="light">{statusLabel}</Badge>
        )}
      </Group>
    </div>
  );
}

// ── Recent Notes view ─────────────────────────────────────────────────────────

function RecentNotesView({
  notes,
  activeNoteId,
  onNavigate,
}: {
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onNavigate: (id: string) => void;
}) {
  const sorted = [...notes]
    .filter((n) => n.type === "note")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (sorted.length === 0) {
    return <Text size="xs" c="dimmed" fs="italic" p="md">No notes yet.</Text>;
  }

  return (
    <>
      {sorted.map((note) => (
        <BrowseNoteCard
          key={note.id}
          note={note}
          isActive={note.id === activeNoteId}
          onNavigate={() => onNavigate(note.id)}
        />
      ))}
    </>
  );
}

// ── Pinned view ───────────────────────────────────────────────────────────────

function PinnedView({
  notes,
  activeNoteId,
  onNavigate,
}: {
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onNavigate: (id: string) => void;
}) {
  const pinned = [...notes]
    .filter((n) => n.pinned)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (pinned.length === 0) {
    return <Text size="xs" c="dimmed" fs="italic" p="md">No pinned notes.</Text>;
  }

  return (
    <>
      {pinned.map((note) => (
        <BrowseNoteCard
          key={note.id}
          note={note}
          isActive={note.id === activeNoteId}
          onNavigate={() => onNavigate(note.id)}
        />
      ))}
    </>
  );
}

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanView({
  notes,
  activeNoteId,
  onNavigate,
  onStatusChange,
}: {
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onNavigate: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const taskNotes = notes.filter((n) => n.kind === "task");

  const buckets = TASK_STATUSES.map(({ id, label }) => ({
    id,
    label,
    notes: taskNotes.filter(
      (n) => (n.kindMeta?.status as string | undefined) === id,
    ),
  }));

  if (taskNotes.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic" p="md">
        No task notes. Right-click a note and change its kind to "Task".
      </Text>
    );
  }

  return (
    <Accordion
      multiple
      defaultValue={TASK_STATUSES.map((s) => s.id)}
      styles={{ item: { border: "none" }, control: { padding: "8px 14px" }, content: { padding: 0 } }}
    >
      {buckets.map(({ id, label, notes: bucketNotes }) => (
        <Accordion.Item key={id} value={id}>
          <Accordion.Control>
            <Group gap={6}>
              <Text size="xs" fw={600} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                {label}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace">{bucketNotes.length}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {bucketNotes.length === 0 ? (
              <Text size="xs" c="dimmed" fs="italic" px="md" pb="xs">Empty</Text>
            ) : (
              bucketNotes.map((note) => (
                <BrowseNoteCard
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  onNavigate={() => onNavigate(note.id)}
                  onStatusChange={(status) => onStatusChange(note.id, status)}
                />
              ))
            )}
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

// ── View definitions ──────────────────────────────────────────────────────────

const VIEWS = [
  { id: "recent", label: "Recent Notes" },
  { id: "pinned", label: "Pinned" },
  { id: "kanban", label: "Kanban" },
];

// ── Browse Pane ───────────────────────────────────────────────────────────────

export function BrowsePane() {
  const [currentVaultId] = useAtom(currentVaultAtom);
  const [view, setView] = useAtom(browsePaneViewAtom);

  const notesQKey = currentVaultId ? notesKeys.byVault(currentVaultId) : notesKeys.all;
  const { data: notes = [] } = useQuery({
    queryKey: notesQKey,
    queryFn: () => getNotes(currentVaultId ?? undefined),
  });

  const navigate = useNavigate();
  const routerState = useRouterState();
  const activeNoteId = routerState.location.pathname.match(/^\/notes\/([^/]+)$/)?.[1] ?? null;

  const qc = useQueryClient();
  const kindMutation = useMutation({
    mutationFn: ({ id, kind, kindMeta }: { id: string; kind: string | null; kindMeta: Record<string, unknown> | null }) =>
      updateNoteKind(id, kind, kindMeta),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesQKey }),
  });

  function handleNavigate(id: string) {
    void navigate({ to: "/notes/$noteId", params: { noteId: id } });
  }

  function handleStatusChange(id: string, status: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    kindMutation.mutate({ id, kind: "task", kindMeta: { ...(note.kindMeta ?? {}), status } });
  }

  const currentView = VIEWS.find((v) => v.id === view) ?? VIEWS[0]!;
  const noteCount = (() => {
    if (view === "recent") return notes.filter((n) => n.type === "note").length;
    if (view === "pinned") return notes.filter((n) => n.pinned).length;
    if (view === "kanban") return notes.filter((n) => n.kind === "task").length;
    return notes.length;
  })();

  const paneStyle: React.CSSProperties = {
    width: 260,
    flexShrink: 0,
    borderRight: "1px solid var(--mantine-color-default-border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--mantine-color-body)",
  };

  return (
    <div style={paneStyle}>
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <Menu position="bottom-start" withArrow>
          <Menu.Target>
            <button
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 4px",
                borderRadius: 4,
                color: "var(--mantine-color-text)",
                fontFamily: "inherit",
              }}
            >
              <Text size="sm" fw={600} style={{ flex: 1, textAlign: "left" }}>
                {currentView.label}
              </Text>
              <Text size="xs" c="dimmed">▾</Text>
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {VIEWS.map((v) => (
              <Menu.Item
                key={v.id}
                onClick={() => setView(v.id)}
                style={{ fontWeight: v.id === view ? 600 : undefined }}
              >
                {v.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Text size="xs" c="dimmed" ff="monospace">{noteCount}</Text>
      </div>

      {/* View content */}
      <ScrollArea flex={1}>
        {view === "recent" && (
          <RecentNotesView notes={notes} activeNoteId={activeNoteId} onNavigate={handleNavigate} />
        )}
        {view === "pinned" && (
          <PinnedView notes={notes} activeNoteId={activeNoteId} onNavigate={handleNavigate} />
        )}
        {view === "kanban" && (
          <KanbanView
            notes={notes}
            activeNoteId={activeNoteId}
            onNavigate={handleNavigate}
            onStatusChange={handleStatusChange}
          />
        )}
      </ScrollArea>
    </div>
  );
}
