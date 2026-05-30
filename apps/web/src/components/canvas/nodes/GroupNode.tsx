import { Paper, TextInput } from "@mantine/core";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useCallback, useState } from "react";

export interface GroupNodeData {
  label?: string;
  onChange?: (label: string) => void;
  readOnly?: boolean;
}

export function GroupNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as GroupNodeData;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label ?? "Group");

  const handleDoubleClick = useCallback(() => {
    if (nodeData.readOnly) return;
    setEditing(true);
  }, [nodeData.readOnly]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData.onChange?.(label);
  }, [label, nodeData]);

  return (
    <>
      <NodeResizer isVisible={selected as boolean} minWidth={200} minHeight={150} />
      <Paper
        withBorder
        style={{
          width: "100%",
          height: "100%",
          background: "rgba(var(--mantine-color-blue-filled-rgb), 0.04)",
          borderStyle: "dashed",
          borderRadius: 8,
          position: "relative",
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div
          style={{
            position: "absolute",
            top: -14,
            left: 8,
            background: "var(--mantine-color-body)",
            padding: "0 4px",
          }}
        >
          {editing ? (
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              onBlur={handleBlur}
              size="xs"
              autoFocus
              styles={{ input: { fontSize: 12, height: 22, minHeight: 22 } }}
            />
          ) : (
            <span style={{ fontSize: 12, color: "var(--mantine-color-dimmed)", userSelect: "none" }}>
              {label}
            </span>
          )}
        </div>
      </Paper>
    </>
  );
}
