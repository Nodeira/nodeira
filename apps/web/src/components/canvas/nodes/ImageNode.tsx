import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";

export interface ImageNodeData {
  url: string;
}

export function ImageNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ImageNodeData;

  return (
    <>
      <NodeResizer isVisible={selected as boolean} minWidth={80} minHeight={60} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 6 }}>
        <img
          src={nodeData.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          draggable={false}
        />
      </div>
    </>
  );
}
