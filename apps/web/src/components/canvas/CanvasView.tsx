import type { CanvasData, CanvasEdgeLineStyle, CanvasNodeSide } from "@nodeira/shared-types";
import "@xyflow/react/dist/style.css";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useRef,
} from "react";
import { CanvasEdge, type CanvasEdgeData } from "./CanvasEdge.js";
import { GroupNode } from "./nodes/GroupNode.js";
import { ImageNode } from "./nodes/ImageNode.js";
import { NoteCardNode } from "./nodes/NoteCardNode.js";
import { TextCardNode } from "./nodes/TextCardNode.js";
import { WebPreviewNode } from "./nodes/WebPreviewNode.js";
import type { AddNodeType } from "./CanvasToolbar.js";

// Context so CanvasEdge can call back to CanvasView without storing functions in edge data
type EdgeDataChangeFn = (id: string, patch: Partial<CanvasEdgeData>) => void;
export const EdgeDataChangeContext = createContext<EdgeDataChangeFn | null>(null);
export function useEdgeDataChange(): EdgeDataChangeFn | null {
  return useContext(EdgeDataChangeContext);
}

// Same pattern for nodes: lets a node (e.g. text/group) persist content edits back
// through the controlled setNodes + save path, without storing functions in node data.
type NodeDataChangeFn = (id: string, patch: Record<string, unknown>) => void;
export const NodeDataChangeContext = createContext<NodeDataChangeFn | null>(null);
export function useNodeDataChange(): NodeDataChangeFn | null {
  return useContext(NodeDataChangeContext);
}

const nodeTypes = {
  text: TextCardNode,
  file: NoteCardNode,
  link: WebPreviewNode,
  group: GroupNode,
  image: ImageNode,
};

const edgeTypes = {
  canvas: CanvasEdge,
};

function canvasDataToFlow(data: CanvasData, readOnly: boolean): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = data.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.x, y: n.y },
    style: { width: n.width, height: n.height },
    data: { ...n, readOnly },
  }));

  const edges: Edge[] = data.edges.map((e) => {
    const edge: Edge = {
      id: e.id,
      source: e.fromNode,
      target: e.toNode,
      sourceHandle: e.fromSide ?? null,
      targetHandle: e.toSide ?? null,
      type: "canvas",
      data: {
        label: e.label ?? "",
        color: e.color,
        lineStyle: e.lineStyle ?? "bezier",
        readOnly,
      },
    };
    if (e.toEnd !== "none") {
      edge.markerEnd = { type: "arrowclosed" };
    }
    return edge;
  });

  return { nodes, edges };
}

function flowToCanvasData(nodes: Node[], edges: Edge[]): CanvasData {
  return {
    nodes: nodes.map((n) => {
      const base = {
        id: n.id,
        type: n.type,
        x: n.position.x,
        y: n.position.y,
        width: (n.style?.width as number) ?? 200,
        height: (n.style?.height as number) ?? 100,
      };
      const nodeData = n.data as Record<string, unknown>;
      // Exclude position/size/id/type — these come from the React Flow node itself (base),
      // not from data; keeping them in data could override current values with stale ones.
      const EXCLUDED = new Set(["readOnly", "onChange", "type", "x", "y", "width", "height", "id"]);
      const rest = Object.fromEntries(Object.entries(nodeData).filter(([k]) => !EXCLUDED.has(k)));
      return { ...base, ...rest } as CanvasData["nodes"][number];
    }),
    edges: edges.map((e) => {
      const ed: CanvasData["edges"][number] = {
        id: e.id,
        fromNode: e.source,
        toNode: e.target,
        toEnd: e.markerEnd ? "arrow" : "none",
      };
      const src = e.sourceHandle as string | null | undefined;
      if (src) ed.fromSide = src as CanvasNodeSide;
      const tgt = e.targetHandle as string | null | undefined;
      if (tgt) ed.toSide = tgt as CanvasNodeSide;
      const eData = (e.data ?? {}) as Record<string, unknown>;
      if (eData.label) ed.label = eData.label as string;
      if (eData.color) ed.color = eData.color as string;
      if (eData.lineStyle) ed.lineStyle = eData.lineStyle as CanvasEdgeLineStyle;
      return ed;
    }),
  };
}

export interface CanvasViewHandle {
  addNode: (type: AddNodeType, x: number, y: number, extraData?: Record<string, unknown>) => void;
  addNodeAtScreenPos: (
    type: AddNodeType,
    screenX: number,
    screenY: number,
    extraData?: Record<string, unknown>,
  ) => void;
}

interface CanvasViewProps {
  initialData: CanvasData;
  onChange?: (data: CanvasData) => void;
  readOnly?: boolean;
}

const NODE_DEFAULTS: Record<AddNodeType, Record<string, unknown>> = {
  text: { text: "" },
  file: {},
  link: {},
  image: {},
  group: { label: "Group" },
};

const NODE_SIZE: Record<AddNodeType, { width: number; height: number }> = {
  text: { width: 200, height: 120 },
  file: { width: 240, height: 160 },
  link: { width: 240, height: 160 },
  image: { width: 200, height: 160 },
  group: { width: 300, height: 200 },
};

function buildFlowNode(
  type: AddNodeType,
  x: number,
  y: number,
  extraData: Record<string, unknown>,
  readOnly: boolean,
): Node {
  const size = NODE_SIZE[type];
  return {
    id: `node-${Date.now()}`,
    type,
    position: { x, y },
    style: { width: size.width, height: size.height },
    data: { ...NODE_DEFAULTS[type], ...extraData, readOnly },
  };
}

export const CanvasView = forwardRef<CanvasViewHandle, CanvasViewProps>(function CanvasView(
  { initialData, onChange, readOnly = false },
  ref,
) {
  const { nodes: initNodes, edges: initEdges } = canvasDataToFlow(initialData, readOnly);
  const [nodes, setNodes] = useNodesState(initNodes);
  const [edges, setEdges] = useEdgesState(initEdges);
  const reactFlow = useReactFlow();

  // Ref always holds the latest nodes so edge data change handler avoids stale closure
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        onChange?.(flowToCanvasData(updated, edges));
        return updated;
      });
    },
    [setNodes, onChange, edges],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        onChange?.(flowToCanvasData(nodes, updated));
        return updated;
      });
    },
    [setEdges, onChange, nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => {
        const newEdges = addEdge(
          {
            ...connection,
            id: `e-${Date.now()}`,
            type: "canvas",
            markerEnd: { type: "arrowclosed" },
            data: { label: "", lineStyle: "bezier" as CanvasEdgeLineStyle, readOnly },
          },
          eds,
        );
        onChange?.(flowToCanvasData(nodes, newEdges));
        return newEdges;
      });
    },
    [readOnly, setEdges, onChange, nodes],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, allNodes: Node[]) => {
      onChange?.(flowToCanvasData(allNodes, edges));
    },
    [onChange, edges],
  );

  // Called by a node (via context) when its content changes (e.g. text/label edits)
  const handleNodeDataChange = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...(n.data as object), ...patch } } : n,
        );
        onChange?.(flowToCanvasData(updated, edges));
        return updated;
      });
    },
    [setNodes, onChange, edges],
  );

  // Called by CanvasEdge (via context) when label or lineStyle changes
  const handleEdgeDataChange = useCallback(
    (edgeId: string, patch: Partial<CanvasEdgeData>) => {
      setEdges((eds) => {
        const updated = eds.map((e) =>
          e.id === edgeId ? { ...e, data: { ...(e.data as object), ...patch } } : e,
        );
        onChange?.(flowToCanvasData(nodesRef.current, updated));
        return updated;
      });
    },
    [setEdges, onChange],
  );

  const addNodeAt = useCallback(
    (type: AddNodeType, x: number, y: number, extraData: Record<string, unknown> = {}) => {
      const newNode = buildFlowNode(type, x, y, extraData, readOnly);
      setNodes((nds) => {
        const updated = [...nds, newNode];
        onChange?.(flowToCanvasData(updated, edges));
        return updated;
      });
    },
    [setNodes, onChange, edges, readOnly],
  );

  useImperativeHandle(
    ref,
    () => ({
      addNode: (type, x, y, extraData = {}) => {
        addNodeAt(type, x, y, extraData);
      },
      addNodeAtScreenPos: (type, screenX, screenY, extraData = {}) => {
        const pos = reactFlow.screenToFlowPosition({ x: screenX, y: screenY });
        addNodeAt(type, pos.x, pos.y, extraData);
      },
    }),
    [addNodeAt, reactFlow],
  );

  return (
    <EdgeDataChangeContext.Provider value={handleEdgeDataChange}>
      <NodeDataChangeContext.Provider value={handleNodeDataChange}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          elevateEdgesOnSelect
          fitView
          deleteKeyCode={readOnly ? null : "Delete"}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          panOnDrag={true}
          style={{ background: "var(--mantine-color-body)" }}
        >
          <Background />
          {!readOnly && <Controls />}
          {!readOnly && <MiniMap />}
        </ReactFlow>
      </NodeDataChangeContext.Provider>
    </EdgeDataChangeContext.Provider>
  );
});
