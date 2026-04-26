import {
  IconFile,
  IconPin,
  IconPinnedOff,
  IconTag,
  IconTrash,
} from "@tabler/icons-react";
import { ActionIcon, Menu, NavLink } from "@mantine/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useRouterState } from "@tanstack/react-router";
import { DynamicIcon } from "../DynamicIcon.js";
import { IconPicker } from "../IconPicker.js";
import { noteKindRegistry } from "../../lib/noteKindRegistry.js";
import type { NoteMetadata } from "@nodeira/shared-types";

export function SortableNoteItem({
  note,
  onDelete,
  onTogglePin,
  onIconChange,
  onKindChange,
}: {
  note: NoteMetadata;
  onDelete: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onKindChange: (id: string, kind: string | null) => void;
}) {
  const routerState = useRouterState();
  const isActive = routerState.location.pathname === `/notes/${note.id}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <Link
        to="/notes/$noteId"
        params={{ noteId: note.id }}
        style={{ textDecoration: "none" }}
      >
        <NavLink
          component="div"
          label={note.title || "Untitled"}
          active={isActive}
          leftSection={
            <IconPicker value={note.icon} onChange={(icon) => onIconChange(note.id, icon)}>
              <span style={{ display: "flex", alignItems: "center" }}>
                {note.icon
                  ? <DynamicIcon name={note.icon} size={14} />
                  : <IconFile size={14} />
                }
              </span>
            </IconPicker>
          }
          rightSection={
            <Menu position="bottom-end" withArrow withinPortal>
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  title="Note options"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                >
                  <IconPin size={12} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={note.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onTogglePin(note.id, !note.pinned); }}
                >
                  {note.pinned ? "Unpin" : "Pin to top"}
                </Menu.Item>
                <Menu.Sub>
                  <Menu.Sub.Target>
                    <Menu.Item leftSection={<IconTag size={14} />}>Change Kind</Menu.Item>
                  </Menu.Sub.Target>
                  <Menu.Sub.Dropdown>
                    {noteKindRegistry.getAll().map((def) => (
                      <Menu.Item
                        key={String(def.id)}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onKindChange(note.id, def.id); }}
                        style={{ fontWeight: note.kind === def.id ? 600 : undefined }}
                      >
                        {def.displayName}
                      </Menu.Item>
                    ))}
                  </Menu.Sub.Dropdown>
                </Menu.Sub>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(note.id, note.title || "Untitled"); }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          }
        />
      </Link>
    </div>
  );
}
