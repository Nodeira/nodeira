export type CanvasNodeSide = "top" | "right" | "bottom" | "left";
export type CanvasEdgeEnd = "none" | "arrow";

export interface CanvasNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface TextCanvasNode extends CanvasNodeBase {
  type: "text";
  text: string;
}

export interface FileCanvasNode extends CanvasNodeBase {
  type: "file";
  /** noteId of the referenced stored note */
  file: string;
  subpath?: string;
}

export interface OgPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  url: string;
}

export interface LinkCanvasNode extends CanvasNodeBase {
  type: "link";
  url: string;
  preview?: OgPreview;
}

export interface GroupCanvasNode extends CanvasNodeBase {
  type: "group";
  label?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat" | "center";
}

export interface ImageCanvasNode extends CanvasNodeBase {
  type: "image";
  url: string;
}

export type CanvasNode =
  | TextCanvasNode
  | FileCanvasNode
  | LinkCanvasNode
  | GroupCanvasNode
  | ImageCanvasNode;

export type CanvasEdgeLineStyle = "straight" | "bezier" | "smoothstep" | "step";

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: CanvasNodeSide;
  fromEnd?: CanvasEdgeEnd;
  toNode: string;
  toSide?: CanvasNodeSide;
  toEnd?: CanvasEdgeEnd;
  color?: string;
  label?: string;
  lineStyle?: CanvasEdgeLineStyle;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface Canvas {
  id: string;
  title: string;
  vaultId: string | null;
  folderId: string | null;
  data: CanvasData;
  pinned: boolean;
  icon: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CanvasMetadata = Omit<Canvas, "data">;
