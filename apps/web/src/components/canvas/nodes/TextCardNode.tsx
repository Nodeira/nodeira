import { Paper, Textarea } from "@mantine/core";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

export interface TextCardNodeData {
  text: string;
  onChange?: (text: string) => void;
  readOnly?: boolean;
}

export function TextCardNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as TextCardNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDoubleClick = useCallback(() => {
    if (nodeData.readOnly) return;
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [nodeData.readOnly]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData.onChange?.(text);
  }, [text, nodeData]);

  return (
    <>
      <NodeResizer isVisible={selected as boolean} minWidth={120} minHeight={60} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Paper
        shadow="xs"
        p="xs"
        style={{
          width: "100%",
          height: "100%",
          cursor: editing ? "text" : "default",
          overflow: "hidden",
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            onBlur={handleBlur}
            autosize
            minRows={2}
            styles={{ input: { border: "none", padding: 0, resize: "none" } }}
          />
        ) : (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
            {text || <span style={{ color: "var(--mantine-color-dimmed)" }}>Double-click to edit…</span>}
          </div>
        )}
      </Paper>
    </>
  );
}
