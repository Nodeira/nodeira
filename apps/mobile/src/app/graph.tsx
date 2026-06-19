import type { NoteMetadata } from "@nodeira/shared-types";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
  Pressable,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Circle, G, Line, Svg, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ErrorState";
import { api, getNoteLinks } from "@/lib/api";

// ── Force simulation ──────────────────────────────────────────────────────────

interface SimNode {
  id: string;
  label: string;
  linkCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimLink {
  source: string;
  target: string;
}

const REPULSION = 2500;
const ATTRACTION = 0.04;
const DAMPING = 0.85;
const GRAVITY = 0.015;
const ITERATIONS = 120;

function runSimulation(nodes: SimNode[], links: SimLink[]): SimNode[] {
  const ns = nodes.map((n) => ({ ...n }));
  const byId = new Map(ns.map((n) => [n.id, n]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion between every pair
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i];
        const b = ns[j];
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y || 0.01;
        const dist2 = dx * dx + dy * dy;
        const force = REPULSION / dist2;
        const fx = force * (dx / Math.sqrt(dist2));
        const fy = force * (dy / Math.sqrt(dist2));
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along links
    for (const link of links) {
      const s = byId.get(link.source);
      const t = byId.get(link.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      s.vx += dx * ATTRACTION;
      s.vy += dy * ATTRACTION;
      t.vx -= dx * ATTRACTION;
      t.vy -= dy * ATTRACTION;
    }

    // Gravity toward center
    for (const n of ns) {
      n.vx -= n.x * GRAVITY;
      n.vy -= n.y * GRAVITY;
    }

    // Integrate
    for (const n of ns) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  return ns;
}

// ── Component ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRAPH_SIZE = 800; // virtual canvas size centered at 0,0

export default function GraphScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const bgSubtle = dark ? "#25262b" : "#f8f9fa";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";
  const nodeColor = dark ? "#4c6ef5" : "#4263eb";
  const edgeColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);

  const {
    data: notes,
    isError: notesError,
    refetch: refetchNotes,
  } = useQuery({
    queryKey: ["notes"],
    queryFn: () => api.get<NoteMetadata[]>("/notes"),
  });

  const {
    data: rawLinks,
    isLoading,
    isError: linksError,
    refetch: refetchLinks,
  } = useQuery({
    queryKey: ["noteLinks"],
    queryFn: getNoteLinks,
  });

  // Build and run simulation once data arrives
  useEffect(() => {
    if (!notes || !rawLinks) return;

    const linkedIds = new Set<string>();
    for (const l of rawLinks) {
      linkedIds.add(l.sourceId);
      linkedIds.add(l.targetId);
    }

    // Show all notes (isolated nodes too)
    const linkCount = new Map<string, number>();
    for (const l of rawLinks) {
      linkCount.set(l.sourceId, (linkCount.get(l.sourceId) ?? 0) + 1);
      linkCount.set(l.targetId, (linkCount.get(l.targetId) ?? 0) + 1);
    }

    const spread = GRAPH_SIZE * 0.4;
    const initialNodes: SimNode[] = notes.map((n) => ({
      id: n.id,
      label: n.title || "Untitled",
      linkCount: linkCount.get(n.id) ?? 0,
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      vx: 0,
      vy: 0,
    }));

    const links: SimLink[] = rawLinks.map((l) => ({
      source: l.sourceId,
      target: l.targetId,
    }));

    const settled = runSimulation(initialNodes, links);
    setSimNodes(settled);
    setSimLinks(links);
  }, [notes, rawLinks]);

  // Pan / pinch state via Reanimated shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.2, Math.min(4, savedScale.value * e.scale));
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function resetView() {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
  }

  // Tap a node: find closest in screen coords (SVG viewBox maps [-size/2, size/2] → screen)
  function handleSvgPress(e: GestureResponderEvent) {
    if (simNodes.length === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    // Map screen coords back to SVG virtual coords
    const svgW = SCREEN_W;
    const svgH = SCREEN_H - insets.top - 48;
    const cx = (locationX / svgW - 0.5) * GRAPH_SIZE;
    const cy = (locationY / svgH - 0.5) * GRAPH_SIZE;

    let closest: SimNode | null = null;
    let minDist = Infinity;
    for (const n of simNodes) {
      const d = Math.hypot(n.x - cx, n.y - cy);
      if (d < minDist) {
        minDist = d;
        closest = n;
      }
    }
    if (closest && minDist < 40) {
      setSelectedId(closest.id === selectedId ? null : closest.id);
    } else {
      setSelectedId(null);
    }
  }

  const selectedNode = simNodes.find((n) => n.id === selectedId) ?? null;
  const connectedIds = selectedId
    ? new Set(
        simLinks
          .filter((l) => l.source === selectedId || l.target === selectedId)
          .flatMap((l) => [l.source, l.target])
          .filter((id) => id !== selectedId),
      )
    : null;

  const headerH = insets.top + 48;
  const svgH = SCREEN_H - headerH;

  if (notesError || linksError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchNotes();
          void refetchLinks();
        }}
        title="Failed to load graph"
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          height: headerH,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          gap: 10,
          backgroundColor: bgSubtle,
          borderBottomWidth: 1,
          borderBottomColor: border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={18} color="#4263eb" />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "600", color: textColor, flex: 1 }}>
          Graph View
        </Text>
        <Text style={{ fontSize: 12, color: textMute }}>
          {simNodes.length} notes · {simLinks.length} links
        </Text>
        <Pressable onPress={resetView} hitSlop={8}>
          <Feather name="maximize-2" size={16} color={textMute} />
        </Pressable>
      </View>

      {isLoading || simNodes.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4263eb" />
          <Text style={{ fontSize: 13, color: textMute, marginTop: 12 }}>
            {isLoading ? "Loading graph…" : "Running layout…"}
          </Text>
        </View>
      ) : (
        <GestureDetector gesture={composed}>
          <Animated.View style={[{ width: SCREEN_W, height: svgH }, animStyle]}>
            <Pressable onPress={handleSvgPress} style={{ flex: 1 }}>
              <Svg
                width={SCREEN_W}
                height={svgH}
                viewBox={`${-GRAPH_SIZE / 2} ${-GRAPH_SIZE / 2} ${GRAPH_SIZE} ${GRAPH_SIZE}`}
              >
                {/* Edges */}
                <G>
                  {simLinks.map((link, i) => {
                    const s = simNodes.find((n) => n.id === link.source);
                    const t = simNodes.find((n) => n.id === link.target);
                    if (!s || !t) return null;
                    const isHighlighted =
                      selectedId && (link.source === selectedId || link.target === selectedId);
                    return (
                      <Line
                        key={i}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={isHighlighted ? "#4263eb" : edgeColor}
                        strokeWidth={isHighlighted ? 1.5 : 1}
                        opacity={selectedId && !isHighlighted ? 0.2 : 1}
                      />
                    );
                  })}
                </G>

                {/* Nodes */}
                <G>
                  {simNodes.map((node) => {
                    const r = 4 + Math.min(node.linkCount, 8) * 1.5;
                    const isSelected = node.id === selectedId;
                    const isConnected = connectedIds?.has(node.id);
                    const dimmed = selectedId && !isSelected && !isConnected;
                    return (
                      <G key={node.id} opacity={dimmed ? 0.25 : 1}>
                        <Circle
                          cx={node.x}
                          cy={node.y}
                          r={r}
                          fill={isSelected ? "#e03131" : isConnected ? "#2f9e44" : nodeColor}
                        />
                        {(isSelected || isConnected || node.linkCount > 2) && (
                          <SvgText
                            x={node.x}
                            y={node.y + r + 10}
                            textAnchor="middle"
                            fontSize={9}
                            fill={dark ? "#c1c2c5" : "#495057"}
                          >
                            {node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label}
                          </SvgText>
                        )}
                      </G>
                    );
                  })}
                </G>
              </Svg>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      )}

      {/* Selected node panel */}
      {selectedNode && (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 16,
            left: 16,
            right: 16,
            backgroundColor: bg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: border,
            padding: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Feather name="file-text" size={16} color="#4263eb" />
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: textColor, flex: 1 }}
              numberOfLines={1}
            >
              {selectedNode.label}
            </Text>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={8}>
              <Feather name="x" size={16} color={textMute} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: textMute, marginBottom: 12 }}>
            {selectedNode.linkCount} link{selectedNode.linkCount !== 1 ? "s" : ""}
          </Text>
          <Pressable
            onPress={() => {
              setSelectedId(null);
              const note = notes?.find((n) => n.id === selectedNode.id);
              if (note) {
                router.push(
                  `/note/${note.id}?title=${encodeURIComponent(note.title)}&type=${note.type}`,
                );
              }
            }}
            style={{
              paddingVertical: 9,
              borderRadius: 8,
              backgroundColor: "#4263eb",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Open note</Text>
          </Pressable>
        </View>
      )}
    </GestureHandlerRootView>
  );
}
