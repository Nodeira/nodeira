import { ActionIcon, Badge, Group, Paper, Tooltip } from "@mantine/core";
import {
  IconFileText,
  IconLink,
  IconNote,
  IconPhoto,
  IconSquare,
} from "@tabler/icons-react";

export type AddNodeType = "text" | "file" | "link" | "image" | "group";

interface CanvasToolbarProps {
  saveStatus: "saved" | "saving" | "idle";
  onAddNode: (type: AddNodeType) => void;
}

export function CanvasToolbar({ saveStatus, onAddNode }: CanvasToolbarProps) {
  return (
    <Paper
      shadow="md"
      p="xs"
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Group gap={4}>
        <Tooltip label="Add Text Card">
          <ActionIcon variant="subtle" onClick={() => onAddNode("text")}>
            <IconNote size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Add Note Reference">
          <ActionIcon variant="subtle" onClick={() => onAddNode("file")}>
            <IconFileText size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Add Image">
          <ActionIcon variant="subtle" onClick={() => onAddNode("image")}>
            <IconPhoto size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Add Web Link">
          <ActionIcon variant="subtle" onClick={() => onAddNode("link")}>
            <IconLink size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Add Group">
          <ActionIcon variant="subtle" onClick={() => onAddNode("group")}>
            <IconSquare size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {saveStatus === "saving" && (
        <Badge color="yellow" size="xs" variant="light">
          Saving…
        </Badge>
      )}
      {saveStatus === "saved" && (
        <Badge color="green" size="xs" variant="light">
          Saved
        </Badge>
      )}
    </Paper>
  );
}
