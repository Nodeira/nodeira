import type { CanvasEdge, CanvasEdgeLineStyle, CanvasNode } from '@nodeira/shared-types';
import { Circle, Defs, G, Marker, Path } from 'react-native-svg';

interface Props {
  edge: CanvasEdge;
  nodes: CanvasNode[];
  selected: boolean;
  onSelect: () => void;
}

interface Point {
  x: number;
  y: number;
}

function getHandlePoint(node: CanvasNode, side: string | undefined): Point {
  if (!side) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
  switch (side) {
    case 'top':    return { x: node.x + node.width / 2, y: node.y };
    case 'right':  return { x: node.x + node.width, y: node.y + node.height / 2 };
    case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':   return { x: node.x, y: node.y + node.height / 2 };
    default:       return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
}

export function buildEdgePath(lineStyle: CanvasEdgeLineStyle | undefined, p1: Point, p2: Point): string {
  const style = lineStyle ?? 'bezier';
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  switch (style) {
    case 'straight':
      return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    case 'step': {
      const midX = p1.x + dx / 2;
      return `M ${p1.x} ${p1.y} H ${midX} V ${p2.y} H ${p2.x}`;
    }
    case 'smoothstep': {
      const midX = p1.x + dx / 2;
      const midY = p1.y + dy / 2;
      return `M ${p1.x} ${p1.y} Q ${midX} ${p1.y} ${midX} ${midY} Q ${midX} ${p2.y} ${p2.x} ${p2.y}`;
    }
    default: { // bezier
      const cx1 = p1.x + dx * 0.3;
      const cy1 = p1.y;
      const cx2 = p2.x - dx * 0.3;
      const cy2 = p2.y;
      return `M ${p1.x} ${p1.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${p2.x} ${p2.y}`;
    }
  }
}

export function getEdgeMidpoint(edge: CanvasEdge, nodes: CanvasNode[]): Point | null {
  const fromNode = nodes.find((n) => n.id === edge.fromNode);
  const toNode = nodes.find((n) => n.id === edge.toNode);
  if (!fromNode || !toNode) return null;
  const p1 = getHandlePoint(fromNode, edge.fromSide);
  const p2 = getHandlePoint(toNode, edge.toSide);
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function CanvasEdgeComponent({ edge, nodes, selected, onSelect }: Props) {
  const fromNode = nodes.find((n) => n.id === edge.fromNode);
  const toNode = nodes.find((n) => n.id === edge.toNode);
  if (!fromNode || !toNode) return null;

  const p1 = getHandlePoint(fromNode, edge.fromSide);
  const p2 = getHandlePoint(toNode, edge.toSide);
  const pathD = buildEdgePath(edge.lineStyle, p1, p2);
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const strokeColor = edge.color ?? (selected ? '#4263eb' : '#868e96');
  const strokeWidth = selected ? 2.5 : 1.5;
  const markerId = `arrow-${edge.id}`;

  return (
    <G>
      <Defs>
        <Marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <Path d="M0,0 L0,6 L8,3 z" fill={strokeColor} />
        </Marker>
      </Defs>

      {/* Invisible wide tap area */}
      <Path
        d={pathD}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        onPress={onSelect}
      />

      {/* Visible edge path */}
      <Path
        d={pathD}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        markerEnd={edge.toEnd === 'arrow' ? `url(#${markerId})` : undefined}
      />

      {/* Midpoint dot when selected */}
      {selected && (
        <Circle
          cx={midX}
          cy={midY}
          r={5}
          fill="#4263eb"
          onPress={onSelect}
        />
      )}
    </G>
  );
}
