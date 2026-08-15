import { ActionIcon, Group, TextInput, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useCallback, useState } from "react";
import type { CanvasEdgeLineStyle } from "@nodeira/shared-types";
import { useEdgeDataChange } from "./CanvasView.js";

export interface CanvasEdgeData {
  label?: string;
  color?: string;
  lineStyle?: CanvasEdgeLineStyle;
  readOnly?: boolean;
}

// Mini SVG path previews for each line style button
const STYLE_ICONS: Record<CanvasEdgeLineStyle, React.ReactNode> = {
  straight: (
    <svg width="20" height="12" viewBox="0 0 20 12">
      <path d="M2,6 L18,6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  bezier: (
    <svg width="20" height="12" viewBox="0 0 20 12">
      <path d="M2,10 C6,10 14,2 18,2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  smoothstep: (
    <svg width="20" height="12" viewBox="0 0 20 12">
      <path d="M2,10 Q10,10 10,6 Q10,2 18,2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  step: (
    <svg width="20" height="12" viewBox="0 0 20 12">
      <path
        d="M2,10 L10,10 L10,2 L18,2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

const STYLE_LABELS: Record<CanvasEdgeLineStyle, string> = {
  straight: "Straight",
  bezier: "Bezier curve",
  smoothstep: "Smooth step",
  step: "Step",
};

const ALL_STYLES: CanvasEdgeLineStyle[] = ["straight", "bezier", "smoothstep", "step"];

function getEdgePath(
  lineStyle: CanvasEdgeLineStyle,
  params: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: EdgeProps["sourcePosition"];
    targetPosition: EdgeProps["targetPosition"];
  },
): [string, number, number, number, number] {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = params;
  switch (lineStyle) {
    case "straight":
      return getStraightPath({ sourceX, sourceY, targetX, targetY });
    case "smoothstep":
      return getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      });
    case "step":
      return getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 0,
      });
    default: // bezier
      return getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }
}

export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const edgeData = (data ?? {}) as CanvasEdgeData;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(edgeData.label ?? "");
  const { deleteElements } = useReactFlow();
  const onDataChange = useEdgeDataChange();

  const lineStyle: CanvasEdgeLineStyle = edgeData.lineStyle ?? "bezier";

  const [edgePath, labelX, labelY] = getEdgePath(lineStyle, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleDoubleClick = useCallback(() => {
    if (edgeData.readOnly) return;
    setEditing(true);
  }, [edgeData.readOnly]);

  const handleLabelBlur = useCallback(() => {
    setEditing(false);
    onDataChange?.(id, { label });
  }, [id, label, onDataChange]);

  const handleStyleChange = useCallback(
    (newStyle: CanvasEdgeLineStyle) => {
      onDataChange?.(id, { lineStyle: newStyle });
    },
    [id, onDataChange],
  );

  const handleDelete = useCallback(() => {
    void deleteElements({ edges: [{ id }] });
  }, [id, deleteElements]);

  const showToolbar = (selected as boolean) && !edgeData.readOnly;

  return (
    <>
      <BaseEdge
        path={edgePath}
        {...(markerEnd !== undefined ? { markerEnd } : {})}
        style={{ stroke: edgeData.color ?? "var(--mantine-color-gray-5)", ...(style ?? {}) }}
      />
      <EdgeLabelRenderer>
        {/* Style toolbar — appears above midpoint when edge is selected */}
        {showToolbar && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 8}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
            // Prevent clicks from bubbling to canvas (which would deselect the edge)
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "var(--mantine-color-body)",
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 6,
                padding: "2px 4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              <Group gap={2} wrap="nowrap">
                {ALL_STYLES.map((s) => (
                  <Tooltip key={s} label={STYLE_LABELS[s]} withArrow position="top" openDelay={400}>
                    <ActionIcon
                      size="xs"
                      variant={lineStyle === s ? "filled" : "subtle"}
                      color={lineStyle === s ? "blue" : "gray"}
                      onClick={() => handleStyleChange(s)}
                    >
                      {STYLE_ICONS[s]}
                    </ActionIcon>
                  </Tooltip>
                ))}
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: "var(--mantine-color-default-border)",
                    margin: "0 2px",
                  }}
                />
                <Tooltip label="Delete edge" withArrow position="top" openDelay={400}>
                  <ActionIcon size="xs" variant="subtle" color="red" onClick={handleDelete}>
                    <IconTrash size={11} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </div>
          </div>
        )}

        {/* Label — double-click to edit. Kept to a minimum size even with no label yet:
            an empty div has a 0×0 hit box, which would make a label impossible to ever
            add in the first place. */}
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            minWidth: 16,
            minHeight: 16,
          }}
          onDoubleClick={handleDoubleClick}
        >
          {editing ? (
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              onBlur={handleLabelBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelBlur();
              }}
              autoFocus
              size="xs"
              styles={{ input: { fontSize: 11, height: 22, minHeight: 22 } }}
            />
          ) : label ? (
            <div
              style={{
                background: "var(--mantine-color-body)",
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 11,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              {label}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
