import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import { useNavigate } from "@tanstack/react-router";
import { useMantineColorScheme } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { backlinksKeys, getBacklinks, getOutLinks, linksKeys } from "../../lib/api.js";
import type { NoteMetadata } from "@nodeira/shared-types";

type NodeRole = "current" | "backlink" | "outlink";

interface LocalNode {
  id: string;
  label: string;
  role: NodeRole;
}

type GraphNode = NodeObject<LocalNode>;

interface LocalGraphProps {
  note: NoteMetadata;
  width: number;
}

const NODE_COLORS: Record<NodeRole, string> = {
  current: "#339af0",
  backlink: "#f06595",
  outlink: "#69db7c",
};

export function LocalGraph({ note, width }: LocalGraphProps) {
  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const fgRef = useRef<ForceGraphMethods<GraphNode>>(undefined);
  const [ready, setReady] = useState(false);

  const { data: backlinks = [] } = useQuery({
    queryKey: backlinksKeys.forNote(note.id),
    queryFn: () => getBacklinks(note.id),
  });

  const { data: outlinks = [] } = useQuery({
    queryKey: linksKeys.forNote(note.id),
    queryFn: () => getOutLinks(note.id),
  });

  const graphData = useMemo(() => {
    const nodeMap = new Map<string, LocalNode>();
    nodeMap.set(note.id, { id: note.id, label: note.title || "Untitled", role: "current" });
    for (const bl of backlinks) {
      if (!nodeMap.has(bl.id)) {
        nodeMap.set(bl.id, { id: bl.id, label: bl.title || "Untitled", role: "backlink" });
      }
    }
    for (const ol of outlinks) {
      if (!nodeMap.has(ol.id)) {
        nodeMap.set(ol.id, { id: ol.id, label: ol.title || "Untitled", role: "outlink" });
      }
    }
    const links = [
      ...backlinks.map((bl) => ({ source: bl.id, target: note.id })),
      ...outlinks.map((ol) => ({ source: note.id, target: ol.id })),
    ];
    return { nodes: Array.from(nodeMap.values()) as GraphNode[], links };
  }, [note, backlinks, outlinks]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      fgRef.current?.centerAt(0, 0, 400);
      fgRef.current?.zoom(2.5, 400);
    }, 300);
    return () => clearTimeout(timer);
  }, [ready, graphData]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.id !== note.id) {
        void navigate({ to: "/notes/$noteId", params: { noteId: node.id as string } });
      }
    },
    [navigate, note.id],
  );

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D) => {
      const role = (node as LocalNode & GraphNode).role ?? "backlink";
      const r = role === "current" ? 6 : 4;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = NODE_COLORS[role];
      ctx.fill();
    },
    [],
  );

  const linkColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
  const bgColor = isDark ? "#1a1b1e" : "#f8f9fa";

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={220}
      backgroundColor={bgColor}
      nodeCanvasObject={paintNode}
      nodeCanvasObjectMode={() => "replace"}
      nodeLabel="label"
      linkColor={() => linkColor}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
      linkWidth={1}
      onNodeClick={handleNodeClick}
      onEngineStop={() => setReady(true)}
      enableZoomInteraction={false}
      enablePanInteraction={false}
      cooldownTicks={80}
      d3AlphaDecay={0.04}
      d3VelocityDecay={0.4}
    />
  );
}
