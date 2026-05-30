import { Box, Image, Paper, Text } from "@mantine/core";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { OgPreview } from "@nodeira/shared-types";

export interface WebPreviewNodeData {
  url: string;
  preview?: OgPreview;
  readOnly?: boolean;
}

export function WebPreviewNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WebPreviewNodeData;
  const { url, preview } = nodeData;

  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <NodeResizer isVisible={selected as boolean} minWidth={200} minHeight={100} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Paper
        shadow="xs"
        style={{ width: "100%", height: "100%", overflow: "hidden", cursor: "pointer" }}
        onClick={handleClick}
      >
        {preview?.image && (
          <Image
            src={preview.image}
            alt=""
            h={80}
            fit="cover"
            style={{ display: "block" }}
          />
        )}
        <Box p="xs">
          <Box style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {preview?.favicon && (
              <img
                src={preview.favicon}
                alt=""
                width={14}
                height={14}
                style={{ borderRadius: 2, flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>
              {preview?.title ?? url}
            </Text>
          </Box>
          {preview?.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {preview.description}
            </Text>
          )}
        </Box>
      </Paper>
    </>
  );
}
