import { Menu } from "@mantine/core";
import {
  IconFileText,
  IconLink,
  IconNote,
  IconPhoto,
  IconSquare,
} from "@tabler/icons-react";
import type { AddNodeType } from "./CanvasToolbar.js";

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode: (type: AddNodeType, x: number, y: number) => void;
}

export function CanvasContextMenu({ x, y, onClose, onAddNode }: CanvasContextMenuProps) {
  const add = (type: AddNodeType) => {
    onAddNode(type, x, y);
    onClose();
  };

  return (
    <div
      style={{ position: "fixed", top: y, left: x, zIndex: 1000 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Menu opened onClose={onClose} withinPortal={false}>
        <Menu.Dropdown>
          <Menu.Label>Add to canvas</Menu.Label>
          <Menu.Item leftSection={<IconNote size={14} />} onClick={() => add("text")}>
            Text Card
          </Menu.Item>
          <Menu.Item leftSection={<IconFileText size={14} />} onClick={() => add("file")}>
            Note Reference
          </Menu.Item>
          <Menu.Item leftSection={<IconPhoto size={14} />} onClick={() => add("image")}>
            Image
          </Menu.Item>
          <Menu.Item leftSection={<IconLink size={14} />} onClick={() => add("link")}>
            Web Link
          </Menu.Item>
          <Menu.Item leftSection={<IconSquare size={14} />} onClick={() => add("group")}>
            Group
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
