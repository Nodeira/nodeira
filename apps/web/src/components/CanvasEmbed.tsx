import { Box, Text } from "@mantine/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { canvasKeys, getCanvas } from "../lib/api.js";
import { CanvasView } from "./canvas/CanvasView.js";

function CanvasEmbedView({ node }: NodeViewProps) {
  const canvasId = node.attrs.canvasId as string;
  const navigate = useNavigate();

  const { data: canvas, isError } = useQuery({
    queryKey: canvasKeys.detail(canvasId),
    queryFn: () => getCanvas(canvasId),
    retry: false,
    enabled: !!canvasId,
  });

  const handleDoubleClick = () => {
    if (!isError && canvas) {
      void navigate({ to: "/canvas/$canvasId", params: { canvasId } });
    }
  };

  return (
    <NodeViewWrapper>
      <Box
        style={{
          height: 300,
          border: "1px solid var(--mantine-color-default-border)",
          borderRadius: 6,
          overflow: "hidden",
          cursor: "pointer",
          position: "relative",
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isError || (!canvas && canvasId) ? (
          <Box
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--mantine-color-gray-0)",
            }}
          >
            <Text size="sm" c="dimmed">Canvas not found</Text>
          </Box>
        ) : canvas ? (
          <ReactFlowProvider>
            <CanvasView initialData={canvas.data} readOnly />
          </ReactFlowProvider>
        ) : (
          <Box
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text size="sm" c="dimmed">Loading canvas…</Text>
          </Box>
        )}
        <Box
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: 11,
            color: "var(--mantine-color-dimmed)",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          Double-click to open
        </Box>
      </Box>
    </NodeViewWrapper>
  );
}

export const CanvasEmbed = Node.create({
  name: "canvasEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      canvasId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-canvas-embed="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-canvas-embed": "true" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasEmbedView);
  },
});
