import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import { useNavigate } from "@tanstack/react-router";
import {
  useMantineColorScheme,
  Box,
  Center,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useResizeObserver } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import {
  getAllLinks,
  getFolders,
  getNotes,
  getVaults,
  graphKeys,
  notesKeys,
  foldersKeys,
  vaultsKeys,
} from "../lib/api.js";
import { currentVaultAtom } from "../store/atoms.js";

interface LocalNode {
  id: string;
  label: string;
  linkCount: number;
}

type GraphNode = NodeObject<LocalNode>;

const BASE_NODE_RADIUS = 4;

export function GraphView() {
  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const [containerRef, containerRect] = useResizeObserver<HTMLDivElement>();
  const fgRef = useRef<ForceGraphMethods<GraphNode>>(undefined);

  const currentVaultId = useAtomValue(currentVaultAtom);
  const [vaultFilter, setVaultFilter] = useState<string | null>(currentVaultId);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: notesKeys.all,
    queryFn: () => getNotes(),
  });

  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: graphKeys.all,
    queryFn: getAllLinks,
  });

  const { data: vaults = [] } = useQuery({
    queryKey: vaultsKeys.all,
    queryFn: getVaults,
  });

  const { data: folders = [] } = useQuery({
    queryKey: foldersKeys.all,
    queryFn: () => getFolders(),
  });

  const isLoading = notesLoading || linksLoading;

  const vaultOptions = useMemo(
    () => [
      { value: "__none__", label: "No vault" },
      ...vaults.map((v) => ({ value: v.id, label: v.name })),
    ],
    [vaults],
  );

  const folderOptions = useMemo(() => {
    const filtered =
      vaultFilter && vaultFilter !== "__none__"
        ? folders.filter((f) => f.vaultId === vaultFilter)
        : folders;
    return [
      { value: "__none__", label: "No folder" },
      ...filtered.map((f) => ({ value: f.id, label: f.name })),
    ];
  }, [folders, vaultFilter]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (sectionFilter === "note" && n.type !== "note") return false;
      if (sectionFilter === "quick" && n.type !== "quick") return false;
      if (vaultFilter === "__none__" && n.vaultId !== null) return false;
      if (vaultFilter && vaultFilter !== "__none__" && n.vaultId !== vaultFilter) return false;
      if (folderFilter === "__none__" && n.folderId !== null) return false;
      if (folderFilter && folderFilter !== "__none__" && n.folderId !== folderFilter) return false;
      return true;
    });
  }, [notes, vaultFilter, sectionFilter, folderFilter]);

  const handleVaultChange = useCallback((val: string | null) => {
    setVaultFilter(val);
    setFolderFilter(null);
  }, []);

  const graphData = useMemo(() => {
    const linkCount = new Map<string, number>();
    for (const l of links) {
      linkCount.set(l.sourceId, (linkCount.get(l.sourceId) ?? 0) + 1);
      linkCount.set(l.targetId, (linkCount.get(l.targetId) ?? 0) + 1);
    }

    const nodes: GraphNode[] = filteredNotes.map((n) => ({
      id: n.id,
      label: n.title || "Untitled",
      linkCount: linkCount.get(n.id) ?? 0,
    }));

    const validIds = new Set(filteredNotes.map((n) => n.id));
    const graphLinks = links
      .filter((l) => validIds.has(l.sourceId) && validIds.has(l.targetId))
      .map((l) => ({ source: l.sourceId, target: l.targetId }));

    return { nodes, links: graphLinks };
  }, [filteredNotes, links]);

  // Deduplication flag: handleContainerClick sets it, handleNodeClick clears it.
  // Prevents double-navigation on browsers where both fire (non-Brave).
  const navigatedRef = useRef(false);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (navigatedRef.current) {
        navigatedRef.current = false;
        return;
      }
      void navigate({ to: "/notes/$noteId", params: { noteId: node.id as string } });
    },
    [navigate],
  );

  // Brave (and any browser with canvas fingerprinting protection) blocks getImageData(),
  // which breaks the library's shadow-canvas hit detection. This handler uses the
  // library's screen2GraphCoords() to do a direct distance test instead.
  const handleContainerClick = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      if (!fgRef.current) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const { x: graphX, y: graphY } = fgRef.current.screen2GraphCoords(
        ev.clientX - rect.left,
        ev.clientY - rect.top,
      );

      let closest: GraphNode | null = null;
      let minDist = Infinity;
      for (const node of graphData.nodes) {
        const nx = node.x ?? 0;
        const ny = node.y ?? 0;
        const lc = (node as LocalNode).linkCount ?? 0;
        const r = BASE_NODE_RADIUS + Math.sqrt(lc) * 1.5 + 4;
        const dist = Math.sqrt((nx - graphX) ** 2 + (ny - graphY) ** 2);
        if (dist <= r && dist < minDist) {
          minDist = dist;
          closest = node;
        }
      }

      if (closest) {
        navigatedRef.current = true;
        void navigate({ to: "/notes/$noteId", params: { noteId: closest.id as string } });
      }
    },
    [graphData.nodes, navigate],
  );

  const nodeColor = isDark ? "#339af0" : "#228be6";
  const linkColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const bgColor = isDark ? "#1a1b1e" : "#f8f9fa";
  const labelColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)";

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const lc = (node as LocalNode & GraphNode).linkCount ?? 0;
      const r = BASE_NODE_RADIUS + Math.sqrt(lc) * 1.5;
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText((node as LocalNode & GraphNode).label ?? "", x, y + r + 2 / globalScale);
    },
    [nodeColor, labelColor],
  );

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const lc = (node as LocalNode & GraphNode).linkCount ?? 0;
      const r = BASE_NODE_RADIUS + Math.sqrt(lc) * 1.5 + 4;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Box
      ref={containerRef}
      onClick={handleContainerClick}
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}
    >
      {containerRect.width > 0 && containerRect.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={containerRect.width}
          height={containerRect.height}
          backgroundColor={bgColor}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={nodePointerAreaPaint}
          nodeLabel="label"
          linkColor={() => linkColor}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkWidth={0.8}
          onNodeClick={handleNodeClick}
          cooldownTicks={120}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          autoPauseRedraw={false}
        />
      )}
      <Paper
        shadow="sm"
        p="xs"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          minWidth: 180,
          pointerEvents: "all",
        }}
      >
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed">
            Filters
          </Text>
          <Select
            placeholder="All sections"
            size="xs"
            clearable
            data={[
              { value: "note", label: "Notes" },
              { value: "quick", label: "Quick Notes" },
            ]}
            value={sectionFilter}
            onChange={setSectionFilter}
          />
          <Select
            placeholder="All vaults"
            size="xs"
            clearable
            data={vaultOptions}
            value={vaultFilter}
            onChange={handleVaultChange}
          />
          <Select
            placeholder="All folders"
            size="xs"
            clearable
            data={folderOptions}
            value={folderFilter}
            onChange={setFolderFilter}
            disabled={folderOptions.length <= 1}
          />
        </Stack>
      </Paper>
    </Box>
  );
}
