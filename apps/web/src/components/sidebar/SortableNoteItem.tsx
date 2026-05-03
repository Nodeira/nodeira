import { createPortal } from "react-dom";
import { useState } from "react";
import {
  IconCheckbox,
  IconFile,
  IconFolderSymlink,
  IconPin,
  IconPinnedOff,
  IconTag,
  IconTrash,
} from "@tabler/icons-react";
import { ActionIcon, Divider, Menu, NavLink, Paper } from "@mantine/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useRouterState } from "@tanstack/react-router";
import { DynamicIcon } from "../DynamicIcon.js";
import { IconPicker } from "../IconPicker.js";
import { noteKindRegistry } from "../../lib/noteKindRegistry.js";
import type { NoteMetadata } from "@nodeira/shared-types";

const CTX_ITEM: React.CSSProperties = {
  padding: "6px 12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: "var(--mantine-font-size-sm)",
  userSelect: "none",
};

function CtxItem({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...CTX_ITEM,
        color: color ?? "var(--mantine-color-text)",
        background: hovered ? "var(--mantine-color-default-hover)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {icon}
      {label}
    </div>
  );
}

export function SortableNoteItem({
  note,
  onDelete,
  onTogglePin,
  onIconChange,
  onKindChange,
  onMove,
}: {
  note: NoteMetadata;
  onDelete: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onKindChange: (id: string, kind: string | null) => void;
  onMove: (note: NoteMetadata) => void;
}) {
  const routerState = useRouterState();
  const isActive = routerState.location.pathname === `/notes/${note.id}`;
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = e.clientY + 200 > window.innerHeight ? e.clientY - 200 : e.clientY;
    setContextPos({ x, y });
  };

  const closeCtx = () => setContextPos(null);

  const isTask = note.kind === "task";

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onContextMenu={handleContextMenu}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0 : 1,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <Link to="/notes/$noteId" params={{ noteId: note.id }} style={{ textDecoration: "none" }}>
          <NavLink
            component="div"
            label={note.title || "Untitled"}
            active={isActive}
            leftSection={
              <IconPicker value={note.icon} onChange={(icon) => onIconChange(note.id, icon)}>
                <span style={{ display: "flex", alignItems: "center" }}>
                  {note.icon ? (
                    <DynamicIcon name={note.icon} size={14} />
                  ) : isTask ? (
                    <IconCheckbox size={14} color="var(--mantine-color-blue-5)" />
                  ) : (
                    <IconFile size={14} />
                  )}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <IconPin size={12} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={note.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onTogglePin(note.id, !note.pinned);
                    }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onKindChange(note.id, def.id);
                          }}
                          style={{ fontWeight: note.kind === def.id ? 600 : undefined }}
                        >
                          {def.displayName}
                        </Menu.Item>
                      ))}
                    </Menu.Sub.Dropdown>
                  </Menu.Sub>
                  <Menu.Item
                    leftSection={<IconFolderSymlink size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onMove(note);
                    }}
                  >
                    Move to…
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDelete(note.id, note.title || "Untitled");
                    }}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            }
          />
        </Link>
      </div>

      {contextPos &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 300 }}
              onClick={closeCtx}
              onContextMenu={(e) => {
                e.preventDefault();
                closeCtx();
              }}
            />
            <Paper
              shadow="md"
              withBorder
              radius="sm"
              style={{
                position: "fixed",
                left: contextPos.x,
                top: contextPos.y,
                zIndex: 301,
                minWidth: 180,
                overflow: "hidden",
                padding: "4px 0",
              }}
            >
              <CtxItem
                icon={note.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
                label={note.pinned ? "Unpin" : "Pin to top"}
                onClick={() => {
                  onTogglePin(note.id, !note.pinned);
                  closeCtx();
                }}
              />
              <CtxItem
                icon={<IconTag size={14} />}
                label={isTask ? "Convert to Note" : "Convert to Task"}
                onClick={() => {
                  onKindChange(note.id, isTask ? null : "task");
                  closeCtx();
                }}
              />
              <CtxItem
                icon={<IconFolderSymlink size={14} />}
                label="Move to…"
                onClick={() => {
                  onMove(note);
                  closeCtx();
                }}
              />
              <Divider my={4} />
              <CtxItem
                icon={<IconTrash size={14} />}
                label="Delete"
                color="var(--mantine-color-red-6)"
                onClick={() => {
                  onDelete(note.id, note.title || "Untitled");
                  closeCtx();
                }}
              />
            </Paper>
          </>,
          document.body,
        )}
    </>
  );
}
