import { IconFilePlus, IconFolder, IconFolderPlus, IconPlus, IconTrash } from "@tabler/icons-react";
import { ActionIcon, Group, Menu, NavLink } from "@mantine/core";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DynamicIcon } from "../DynamicIcon.js";
import { IconPicker } from "../IconPicker.js";
import { SortableNoteItem } from "./SortableNoteItem.js";
import type { Folder, NoteMetadata } from "@nodeira/shared-types";

interface FolderNavItemProps {
  folder: Folder;
  /** Full folder list — used to resolve child folders for recursive rendering. */
  allFolders: Folder[];
  /** Full (non-quick) note list — each folder selects its own notes. */
  notes: NoteMetadata[];
  search: string;
  onCreateNote: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onDelete: (id: string, name: string) => void;
  onDeleteNote: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNoteIconChange: (id: string, icon: string | null) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onNoteKindChange: (id: string, kind: string | null) => void;
  onMoveNote: (note: NoteMetadata) => void;
}

export function FolderNavItem(props: FolderNavItemProps) {
  const {
    folder,
    allFolders,
    notes,
    search,
    onCreateNote,
    onCreateFolder,
    onDelete,
    onDeleteNote,
    onTogglePin,
    onNoteIconChange,
    onIconChange,
    onNoteKindChange,
    onMoveNote,
  } = props;

  const childFolders = allFolders.filter((f) => f.parentId === folder.id);

  // Direct notes in this folder (pinned notes live in the Pinned section, not here).
  const filtered = notes
    .filter((n) => n.folderId === folder.id && !n.pinned)
    .filter((n) => !search || n.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());

  const { setNodeRef, isOver } = useDroppable({ id: `folder-drop-${folder.id}` });

  // While searching, keep a folder visible if anything in its subtree matches.
  function subtreeHasMatch(folderId: string): boolean {
    const direct = notes.some(
      (n) =>
        n.folderId === folderId &&
        !n.pinned &&
        n.title.toLowerCase().includes(search.toLowerCase()),
    );
    if (direct) return true;
    return allFolders.filter((f) => f.parentId === folderId).some((f) => subtreeHasMatch(f.id));
  }

  if (search && !subtreeHasMatch(folder.id)) return null;

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
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="green"
                  title={`Add to ${folder.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                <Menu.Item
                  leftSection={<IconFilePlus size={14} />}
                  onClick={() => onCreateNote(folder.id)}
                >
                  New note
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFolderPlus size={14} />}
                  onClick={() => onCreateFolder(folder.id)}
                >
                  New subfolder
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        }
      >
        {/* Nested subfolders first, then this folder's notes */}
        {childFolders.map((child) => (
          <FolderNavItem key={child.id} {...props} folder={child} />
        ))}
        <SortableContext items={filtered.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          {filtered.map((note) => (
            <SortableNoteItem
              key={note.id}
              note={note}
              onDelete={onDeleteNote}
              onTogglePin={onTogglePin}
              onIconChange={onNoteIconChange}
              onKindChange={onNoteKindChange}
              onMove={onMoveNote}
            />
          ))}
        </SortableContext>
      </NavLink>
    </div>
  );
}
