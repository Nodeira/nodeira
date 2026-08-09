import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useAttachmentUrl } from "../../../lib/attachments.js";

export interface ImageNodeData {
  url: string;
}

export function ImageNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ImageNodeData;
  // Canvas images may be uploads or arbitrary external URLs; the hook passes the latter
  // through untouched and resolves the former against the attachment route.
  const src = useAttachmentUrl(nodeData.url);

  return (
    <>
      <NodeResizer isVisible={selected as boolean} minWidth={80} minHeight={60} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 6 }}>
        {/* Rendered only once resolved — `src=""` makes the browser re-request the page. */}
        {src !== undefined && (
          <img
            src={src}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            draggable={false}
          />
        )}
      </div>
    </>
  );
}
