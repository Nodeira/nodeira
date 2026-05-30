import type {
  CanvasData,
  CanvasEdge as CanvasEdgeType,
  CanvasEdgeLineStyle,
  CanvasNode,
  CanvasNodeSide,
} from "@nodeira/shared-types";
import { Feather } from "@expo/vector-icons";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Modal, Pressable, Text, View, useColorScheme, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  runOnJS,
  withTiming,
} from "react-native-reanimated";
import Svg, { G } from "react-native-svg";

import { CanvasEdgeComponent } from "./CanvasEdge";
import { CanvasNodeWrapper } from "./CanvasNodeWrapper";

const AnimatedG = Animated.createAnimatedComponent(G);

export type AddNodeType = "text" | "file" | "link" | "group" | "image";

export interface PendingConnection {
  fromNodeId: string;
  fromSide: CanvasNodeSide;
}

export interface CanvasViewHandle {
  addNode: (
    type: AddNodeType,
    canvasX: number,
    canvasY: number,
    extraData?: Record<string, unknown>,
  ) => void;
  fitView: () => void;
}

interface CanvasViewProps {
  initialData: CanvasData;
  onChange?: (data: CanvasData) => void;
  readOnly?: boolean;
}

const CANVAS_SIZE = 10000;

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

const LINE_STYLES: CanvasEdgeLineStyle[] = ["bezier", "straight", "smoothstep", "step"];
const STYLE_LABELS: Record<CanvasEdgeLineStyle, string> = {
  bezier: "Bezier",
  straight: "Straight",
  smoothstep: "Smooth Step",
  step: "Step",
};

function computeFitView(
  nodes: CanvasNode[],
  screenWidth: number,
  screenHeight: number,
): { tx: number; ty: number; sc: number } {
  const half = CANVAS_SIZE / 2;
  if (nodes.length === 0) {
    return { tx: screenWidth / 2 - half, ty: screenHeight / 2 - half, sc: 1 };
  }
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const bw = maxX - minX || 200;
  const bh = maxY - minY || 120;
  const padding = 40;
  const sc = Math.min((screenWidth - padding * 2) / bw, (screenHeight - padding * 2) / bh, 2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // RN scales around the view center (half, half), so compensate:
  // screen_pos = (canvas_pos - half) * sc + half + translate
  const tx = screenWidth / 2 - cx * sc + half * (sc - 1);
  const ty = screenHeight / 2 - cy * sc + half * (sc - 1);
  return { tx, ty, sc };
}

export const CanvasView = forwardRef<CanvasViewHandle, CanvasViewProps>(function CanvasView(
  { initialData, onChange, readOnly = false },
  ref,
) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const dark = useColorScheme() === "dark";

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const border = dark ? "#373a40" : "#e9ecef";

  const [nodes, setNodes] = useState<CanvasNode[]>(initialData.nodes);
  const [edges, setEdges] = useState<CanvasEdgeType[]>(initialData.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [edgeMenuVisible, setEdgeMenuVisible] = useState(false);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const selectedEdgeIdRef = useRef(selectedEdgeId);
  selectedEdgeIdRef.current = selectedEdgeId;

  const initFit = computeFitView(initialData.nodes, screenW, screenH);

  const translateX = useSharedValue(initFit.tx);
  const translateY = useSharedValue(initFit.ty);
  const scale = useSharedValue(initFit.sc);

  const savedTX = useSharedValue(initFit.tx);
  const savedTY = useSharedValue(initFit.ty);
  const savedScale = useSharedValue(initFit.sc);

  // Saved state at pinch-start — separate from pan saved values to avoid conflicts
  const pinchSavedTX = useSharedValue(initFit.tx);
  const pinchSavedTY = useSharedValue(initFit.ty);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // SVG lives at screen size; this G transform mirrors the Animated.View transform.
  // RN scales around the view center (CANVAS_SIZE/2), so we compensate:
  // screen_pos = sc * canvas_pos + CANVAS_SIZE/2 * (1 - sc) + translate
  // Use matrix instead of transform string — Reanimated on Android casts transform
  // through the bridge expecting ReadableArray, not String.
  const edgeLayerProps = useAnimatedProps(() => {
    const half = CANVAS_SIZE / 2;
    const tx = translateX.value + half * (1 - scale.value);
    const ty = translateY.value + half * (1 - scale.value);
    // matrix(a,b,c,d,e,f) equivalent to translate(tx,ty) scale(s)
    return { matrix: [scale.value, 0, 0, scale.value, tx, ty] };
  });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      pinchSavedTX.value = translateX.value;
      pinchSavedTY.value = translateY.value;
      pinchFocalX.value = e.focalX;
      pinchFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const half = CANVAS_SIZE / 2;
      const newScale = Math.min(4, Math.max(0.2, savedScale.value * e.scale));
      scale.value = newScale;
      // Keep the canvas point under the initial focal anchored to the current focal.
      // Transform: screen = (canvas - half) * scale + half + translate
      // Solving for translate given that focal maps to e.focalX/Y:
      translateX.value =
        e.focalX -
        ((pinchFocalX.value - half - pinchSavedTX.value) / savedScale.value) * newScale -
        half;
      translateY.value =
        e.focalY -
        ((pinchFocalY.value - half - pinchSavedTY.value) / savedScale.value) * newScale -
        half;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(setSelectedNodeId)(null);
    runOnJS(setSelectedEdgeId)(null);
    runOnJS(setPendingConnection)(null);
  });

  const combinedBgGesture = Gesture.Simultaneous(
    Gesture.Simultaneous(panGesture, pinchGesture),
    tapGesture,
  );

  const notifyChange = useCallback(
    (newNodes: CanvasNode[], newEdges: CanvasEdgeType[]) => {
      onChange?.({ nodes: newNodes, edges: newEdges });
    },
    [onChange],
  );

  const handleNodeDragEnd = useCallback(
    (nodeId: string, x: number, y: number) => {
      setNodes((prev) => {
        const updated = prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n));
        notifyChange(updated, edgesRef.current);
        return updated;
      });
    },
    [notifyChange],
  );

  const handleNodeDataChange = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((prev) => {
        const updated = prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n));
        notifyChange(updated, edgesRef.current);
        return updated;
      });
    },
    [notifyChange],
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const updatedNodes = prev.filter((n) => n.id !== nodeId);
        const updatedEdges = edgesRef.current.filter(
          (e) => e.fromNode !== nodeId && e.toNode !== nodeId,
        );
        setEdges(updatedEdges);
        notifyChange(updatedNodes, updatedEdges);
        return updatedNodes;
      });
      setSelectedNodeId(null);
    },
    [notifyChange],
  );

  const handleHandleTap = useCallback(
    (nodeId: string, side: CanvasNodeSide) => {
      if (pendingConnection) {
        if (pendingConnection.fromNodeId === nodeId) {
          setPendingConnection(null);
          return;
        }
        const newEdge: CanvasEdgeType = {
          id: `e-${Date.now()}`,
          fromNode: pendingConnection.fromNodeId,
          fromSide: pendingConnection.fromSide,
          toNode: nodeId,
          toSide: side,
          toEnd: "arrow",
          lineStyle: "bezier",
        };
        setEdges((prev) => {
          const updated = [...prev, newEdge];
          notifyChange(nodesRef.current, updated);
          return updated;
        });
        setPendingConnection(null);
      } else {
        setPendingConnection({ fromNodeId: nodeId, fromSide: side });
      }
    },
    [pendingConnection, notifyChange],
  );

  const handleEdgeSelect = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setEdgeMenuVisible(true);
  }, []);

  const handleEdgeDelete = useCallback(() => {
    const edgeId = selectedEdgeIdRef.current;
    if (!edgeId) return;
    setEdges((prev) => {
      const updated = prev.filter((e) => e.id !== edgeId);
      notifyChange(nodesRef.current, updated);
      return updated;
    });
    setSelectedEdgeId(null);
    setEdgeMenuVisible(false);
  }, [notifyChange]);

  const handleEdgeStyleChange = useCallback(
    (style: CanvasEdgeLineStyle) => {
      const edgeId = selectedEdgeIdRef.current;
      if (!edgeId) return;
      setEdges((prev) => {
        const updated = prev.map((e) => (e.id === edgeId ? { ...e, lineStyle: style } : e));
        notifyChange(nodesRef.current, updated);
        return updated;
      });
      setEdgeMenuVisible(false);
    },
    [notifyChange],
  );

  const zoomIn = () => {
    scale.value = withTiming(Math.min(4, scale.value * 1.25), { duration: 200 });
  };
  const zoomOut = () => {
    scale.value = withTiming(Math.max(0.2, scale.value / 1.25), { duration: 200 });
  };

  const fitView = useCallback(() => {
    const { tx, ty, sc } = computeFitView(nodesRef.current, screenW, screenH);
    translateX.value = withTiming(tx, { duration: 300 });
    translateY.value = withTiming(ty, { duration: 300 });
    scale.value = withTiming(sc, { duration: 300 });
  }, [screenW, screenH, translateX, translateY, scale]);

  useImperativeHandle(ref, () => ({
    addNode: (type, canvasX, canvasY, extraData = {}) => {
      const size = NODE_SIZE[type];
      const newNode = {
        id: `node-${Date.now()}`,
        type,
        x: canvasX,
        y: canvasY,
        width: size.width,
        height: size.height,
        ...NODE_DEFAULTS[type],
        ...extraData,
      } as CanvasNode;
      setNodes((prev) => {
        const updated = [...prev, newNode];
        notifyChange(updated, edgesRef.current);
        return updated;
      });
    },
    fitView,
  }));

  return (
    <View style={{ flex: 1, overflow: "hidden" }}>
      <GestureDetector gesture={combinedBgGesture}>
        <View style={{ flex: 1 }}>
          {/* Screen-sized SVG edge layer — avoids Android bitmap limit from a 10k×10k canvas SVG */}
          <Svg width={screenW} height={screenH} style={{ position: "absolute", top: 0, left: 0 }}>
            {/* @ts-expect-error — matrix is a valid SVG transform attribute on Android but is not typed in react-native-svg GProps */}
            <AnimatedG animatedProps={edgeLayerProps}>
              {edges.map((edge) => (
                <CanvasEdgeComponent
                  key={edge.id}
                  edge={edge}
                  nodes={nodes}
                  selected={selectedEdgeId === edge.id}
                  onSelect={() => handleEdgeSelect(edge.id)}
                />
              ))}
            </AnimatedG>
          </Svg>

          {/* Node layer — box-none lets touches pass through to SVG edges below */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              {
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                position: "absolute",
                top: 0,
                left: 0,
              },
              canvasStyle,
            ]}
          >
            {nodes.map((node) => (
              <CanvasNodeWrapper
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                readOnly={readOnly}
                pendingConnection={pendingConnection}
                canvasScale={scale}
                onSelect={() => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                onDragEnd={handleNodeDragEnd}
                onDataChange={handleNodeDataChange}
                onDelete={handleNodeDelete}
                onHandleTap={handleHandleTap}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Zoom + fit controls */}
      {!readOnly && (
        <View style={{ position: "absolute", bottom: 90, right: 16, gap: 4 }}>
          <Pressable
            onPress={zoomIn}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={zoomOut}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="minus" size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={fitView}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="maximize-2" size={16} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* Edge actions modal — rendered outside SVG context */}
      <Modal
        visible={edgeMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEdgeMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setEdgeMenuVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
              paddingTop: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: border,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: "#868e96",
                paddingHorizontal: 20,
                paddingBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Line Style
            </Text>
            {LINE_STYLES.map((s) => {
              const currentStyle =
                edges.find((e) => e.id === selectedEdgeId)?.lineStyle ?? "bezier";
              return (
                <Pressable
                  key={s}
                  onPress={() => handleEdgeStyleChange(s)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: currentStyle === s ? "#4263eb" : "transparent",
                      borderWidth: 2,
                      borderColor: currentStyle === s ? "#4263eb" : border,
                    }}
                  />
                  <Text style={{ fontSize: 15, color: textColor }}>{STYLE_LABELS[s]}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={handleEdgeDelete}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 12,
                marginTop: 8,
                borderTopWidth: 1,
                borderTopColor: border,
              }}
            >
              <Text style={{ fontSize: 15, color: "#e03131", fontWeight: "500" }}>Delete Edge</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});
