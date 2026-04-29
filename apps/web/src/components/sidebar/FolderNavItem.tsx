import { IconFolder, IconPlus, IconTrash } from "@tabler/icons-react";
import { ActionIcon, Group, NavLink } from "@mantine/core";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DynamicIcon } from "../DynamicIcon.js";
import { IconPicker } from "../IconPicker.js";
import { SortableNoteItem } from "./SortableNoteItem.js";
import type { Folder, NoteMetadata } from "@nodeira/shared-types";

export function FolderNavItem({
  folder,
  notes,
  search,
  onCreateNote,
  onDelete,
  onDeleteNote,
  onTogglePin,
  onNoteIconChange,
  onIconChange,
  onNoteKindChange,
}: {
  folder: Folder;
  notes: NoteMetadata[];
  search: string;
  onCreateNote: (folderId: string) => void;
  onDelete: (id: string, name: string) => void;
  onDeleteNote: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNoteIconChange: (id: string, icon: string | null) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onNoteKindChange: (id: string, kind: string | null) => void;
}) {
  const filtered = notes
    .filter((n) => !search || n.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());

  const { setNodeRef, isOver } = useDroppable({ id: `folder-drop-${folder.id}` });

  if (search && filtered.length === 0) return null;

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 4,
        outline: isOver ? "2px solid var(--mantine-color-blue-4)" : undefined,
      }}
    >
      <NavLink
        label={folder.name}
        leftSection={
          <IconPicker
            value={folder.icon ?? null}
            onChange={(icon) => onIconChange(folder.id, icon)}
          >
            <span style={{ display: "flex", alignItems: "center" }}>
              {folder.icon ? (
                <DynamicIcon name={folder.icon} size={14} />
              ) : (
                <IconFolder size={14} />
              )}
            </span>
          </IconPicker>
        }
        defaultOpened
        disableRightSectionRotation
        rightSection={
          <Group gap={2} wrap="nowrap">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              title={`Delete ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder.id, folder.name);
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              title={`New note in ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(folder.id);
              }}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Group>
        }
      >
        <SortableContext items={filtered.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          {filtered.map((note) => (
            <SortableNoteItem
              key={note.id}
              note={note}
              onDelete={onDeleteNote}
              onTogglePin={onTogglePin}
              onIconChange={onNoteIconChange}
              onKindChange={onNoteKindChange}
            />
          ))}
        </SortableContext>
      </NavLink>
    </div>
  );
}
