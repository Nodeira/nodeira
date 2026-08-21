import { createPortal } from "react-dom";
import { useState } from "react";
import {
  IconFolderSymlink,
  IconLayout,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from "@tabler/icons-react";
import { ActionIcon, Divider, Menu, NavLink, Paper } from "@mantine/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Link, useRouterState } from "@tanstack/react-router";
import { DynamicIcon } from "../DynamicIcon.js";
import { IconPicker } from "../IconPicker.js";
import type { Canvas } from "@nodeira/shared-types";

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

/**
 * Sidebar tree entry for a canvas — the same shape as `SortableNoteItem` but using
 * `useDraggable` rather than `useSortable`: canvases can be dragged onto a folder's
 * drop zone (moving them into that folder) but don't yet support drag-to-reorder
 * within a folder — that still goes through the "Move to…" menu.
 */
export function CanvasNavItem({
  canvas,
  onDelete,
  onTogglePin,
  onIconChange,
  onMove,
}: {
  canvas: Canvas;
  onDelete: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onMove: (canvas: Canvas) => void;
}) {
  const routerState = useRouterState();
  const isActive = routerState.location.pathname === `/canvas/${canvas.id}`;
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: canvas.id,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = e.clientY + 200 > window.innerHeight ? e.clientY - 200 : e.clientY;
    setContextPos({ x, y });
  };

  const closeCtx = () => setContextPos(null);

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onContextMenu={handleContextMenu}
        style={{
          transform: CSS.Translate.toString(transform),
          opacity: isDragging ? 0 : 1,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <Link
          to="/canvas/$canvasId"
          params={{ canvasId: canvas.id }}
          style={{ textDecoration: "none" }}
        >
          <NavLink
            component="div"
            label={canvas.title || "Untitled Canvas"}
            active={isActive}
            leftSection={
              <IconPicker value={canvas.icon} onChange={(icon) => onIconChange(canvas.id, icon)}>
                <span style={{ display: "flex", alignItems: "center" }}>
                  {canvas.icon ? (
                    <DynamicIcon name={canvas.icon} size={14} />
                  ) : (
                    <IconLayout size={14} />
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
                    title="Canvas options"
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
                    leftSection={
                      canvas.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onTogglePin(canvas.id, !canvas.pinned);
                    }}
                  >
                    {canvas.pinned ? "Unpin" : "Pin to top"}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFolderSymlink size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onMove(canvas);
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
                      onDelete(canvas.id, canvas.title || "Untitled Canvas");
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
                icon={canvas.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
                label={canvas.pinned ? "Unpin" : "Pin to top"}
                onClick={() => {
                  onTogglePin(canvas.id, !canvas.pinned);
                  closeCtx();
                }}
              />
              <CtxItem
                icon={<IconFolderSymlink size={14} />}
                label="Move to…"
                onClick={() => {
                  onMove(canvas);
                  closeCtx();
                }}
              />
              <Divider my={4} />
              <CtxItem
                icon={<IconTrash size={14} />}
                label="Delete"
                color="var(--mantine-color-red-6)"
                onClick={() => {
                  onDelete(canvas.id, canvas.title || "Untitled Canvas");
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
