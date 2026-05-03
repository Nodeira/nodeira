import { useRef, useState } from "react";
import {
  IconArrowUpRight,
  IconPhoto,
  IconPin,
  IconPinFilled,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNote,
  deleteNote,
  getNotes,
  notesKeys,
  updateNotePin,
  uploadImage,
} from "../lib/api.js";
import { getOrCreateYjsContext } from "../providers/YjsProvider.js";
import type { NoteMetadata } from "@nodeira/shared-types";
import "../components/editor.css";

export const Route = createFileRoute("/quick-notes")({
  component: QuickNotesPage,
});

// ── Per-card collapsed height (≈ 10 lines at 1.5 line-height) ────────────────
const COLLAPSED_HEIGHT = "15rem";

// ── Individual quick-note card ────────────────────────────────────────────────

function QuickNoteCard({
  note,
  onDelete,
  onTogglePin,
}: {
  note: NoteMetadata;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Collapse when clicking outside the card
  const cardRef = useClickOutside<HTMLDivElement>(() => setExpanded(false));

  const { doc } = getOrCreateYjsContext(note.id);

  const editor = useEditor({
    extensions: [
      // Quick notes: paragraph, bold/italic, lists, images only
      StarterKit.configure({
        undoRedo: false,
        codeBlock: false,
        heading: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Collaboration.configure({ document: doc }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Image,
    ],
    onTransaction: () => {
      // Check whether content overflows the collapsed height
      if (contentRef.current) {
        setOverflows(contentRef.current.scrollHeight > contentRef.current.clientHeight);
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ url }) => editor?.chain().focus().setImage({ src: url }).run(),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  function handleCardClick() {
    if (!expanded) {
      setExpanded(true);
      // Focus the editor after the state update settles
      setTimeout(() => editor?.commands.focus("end"), 0);
    }
  }

  return (
    <Card
      ref={cardRef}
      padding="sm"
      radius="sm"
      withBorder
      style={{ cursor: "text", position: "relative" }}
      onClick={handleCardClick}
    >
      <Stack gap={4} style={{ height: "100%" }}>
        {/* Content area — capped height when collapsed */}
        <Box
          ref={contentRef}
          className={!expanded ? "quick-note-collapsed" : ""}
          style={{
            maxHeight: expanded ? undefined : COLLAPSED_HEIGHT,
            overflow: "hidden",
            position: "relative",
            flex: 1,
          }}
        >
          <EditorContent editor={editor} />

          {/* Overflow indicator: gradient + "· · ·" pill */}
          {!expanded && overflows && (
            <Box
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "4rem",
                background: "linear-gradient(to bottom, transparent, var(--mantine-color-body))",
                pointerEvents: "none",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 4,
              }}
            >
              <Text
                size="xs"
                c="dimmed"
                style={{
                  background: "var(--mantine-color-default-hover)",
                  borderRadius: 999,
                  padding: "1px 10px",
                  letterSpacing: "0.15em",
                }}
              >
                · · ·
              </Text>
            </Box>
          )}
        </Box>

        {/* Footer: date + actions */}
        <Group justify="space-between" align="center" gap={4} mt={4}>
          <Text size="xs" c="dimmed">
            {new Date(note.updatedAt).toLocaleDateString()}
          </Text>
          <Group gap={4}>
            {/* Pin / unpin */}
            <ActionIcon
              size="sm"
              variant="subtle"
              color={note.pinned ? "yellow" : "gray"}
              title={note.pinned ? "Unpin note" : "Pin note"}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id, !note.pinned);
              }}
            >
              {note.pinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
            </ActionIcon>

            {/* Image upload */}
            <ActionIcon
              size="sm"
              variant="subtle"
              title="Insert image"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <IconPhoto size={16} />
            </ActionIcon>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {/* Open full page */}
            <ActionIcon
              size="sm"
              variant="subtle"
              title="Open full page"
              onClick={(e) => {
                e.stopPropagation();
                void navigate({ to: "/notes/$noteId", params: { noteId: note.id } });
              }}
            >
              <IconArrowUpRight size={16} />
            </ActionIcon>

            {/* Delete */}
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              title="Delete note"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function QuickNotesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: notes = [] } = useQuery({ queryKey: notesKeys.all, queryFn: () => getNotes() });

  const quickNotes = notes.filter((n) => n.type === "quick");

  const filtered = search
    ? quickNotes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : quickNotes;

  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);

  const createNoteMutation = useMutation({
    mutationFn: () => createNote({ type: "quick" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => updateNotePin(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });

  function renderGrid(noteList: NoteMetadata[]) {
    return (
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="sm">
        {noteList.map((note) => (
          <QuickNoteCard
            key={note.id}
            note={note}
            onDelete={(id) => deleteNoteMutation.mutate(id)}
            onTogglePin={(id, p) => pinMutation.mutate({ id, pinned: p })}
          />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3}>Quick Notes</Title>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {quickNotes.length} {quickNotes.length === 1 ? "note" : "notes"}
          </Text>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            loading={createNoteMutation.isPending}
            onClick={() => createNoteMutation.mutate()}
          >
            New
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Search quick notes…"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        style={{ maxWidth: 320 }}
      />

      {quickNotes.length === 0 ? (
        <Text c="dimmed" size="sm" fs="italic">
          No quick notes yet. Hit &ldquo;New&rdquo; to create one.
        </Text>
      ) : filtered.length === 0 ? (
        <Text c="dimmed" size="sm" fs="italic">
          No quick notes match &ldquo;{search}&rdquo;.
        </Text>
      ) : (
        <Stack gap="md">
          {pinned.length > 0 && (
            <Stack gap="xs">
              <Group gap="xs" align="center">
                <IconPinFilled size={14} />
                <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                  Pinned
                </Text>
              </Group>
              {renderGrid(pinned)}
              {unpinned.length > 0 && <Divider />}
            </Stack>
          )}
          {unpinned.length > 0 && renderGrid(unpinned)}
        </Stack>
      )}
    </Stack>
  );
}
