import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Badge } from "@mantine/core";

function HashTagView({ node }: NodeViewProps) {
  const { tag } = node.attrs as { tag: string };
  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }} contentEditable={false}>
      <Badge size="sm" variant="light" color="indigo" style={{ cursor: "default", verticalAlign: "middle" }}>
        {tag}
      </Badge>
    </NodeViewWrapper>
  );
}

export const HashTag = Node.create({
  name: "hashTag",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tag: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-hash-tag]",
        getAttrs: (el) => ({
          tag: (el as HTMLElement).getAttribute("data-hash-tag") || "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-hash-tag": node.attrs.tag ?? "",
        class: "hash-tag",
      }),
      `#${node.attrs.tag ?? ""}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HashTagView);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /#([\w-]+)\s$/,
        type: this.type,
        getAttributes: (match) => ({ tag: match[1] }),
      }),
    ];
  },
});
