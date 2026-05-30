import { Badge, Box, Paper, Text } from "@mantine/core";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getNote, getNoteContent, notesKeys } from "../../../lib/api.js";

export interface NoteCardNodeData {
  file: string; // noteId
  readOnly?: boolean;
}

export function NoteCardNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NoteCardNodeData;
  const navigate = useNavigate();

  const { data: note, isError } = useQuery({
    queryKey: notesKeys.detail(nodeData.file),
    queryFn: () => getNote(nodeData.file),
    retry: false,
  });

  const { data: content } = useQuery({
    queryKey: [...notesKeys.detail(nodeData.file), "content"],
    queryFn: () => getNoteContent(nodeData.file),
    enabled: !!note && !isError,
    retry: false,
  });

  const isDeleted = isError || (!note && !!nodeData.file);

  const handleDoubleClick = () => {
    if (isDeleted || nodeData.readOnly) return;
    void navigate({ to: "/notes/$noteId", params: { noteId: nodeData.file } });
  };

  return (
    <>
      <NodeResizer isVisible={selected as boolean} minWidth={160} minHeight={80} />
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
          overflow: "hidden",
          cursor: isDeleted ? "not-allowed" : "pointer",
          background: isDeleted ? "var(--mantine-color-gray-1)" : undefined,
          opacity: isDeleted ? 0.7 : 1,
          display: "flex",
          flexDirection: "column",
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isDeleted ? (
          <Box>
            <Text size="sm" fw={700} style={{ textDecoration: "line-through" }} c="dimmed">
              {nodeData.file}
            </Text>
            <Badge color="red" size="xs" mt={4}>Note deleted</Badge>
          </Box>
        ) : (
          <>
            <Text size="sm" fw={700} lineClamp={1} style={{ flexShrink: 0 }}>
              {note?.title ?? "Loading…"}
            </Text>
            {content && (
              <Text
                size="xs"
                c="dimmed"
                mt={4}
                style={{
                  flex: 1,
                  overflow: "hidden",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: 1.5,
                }}
              >
                {content}
              </Text>
            )}
          </>
        )}
      </Paper>
    </>
  );
}
