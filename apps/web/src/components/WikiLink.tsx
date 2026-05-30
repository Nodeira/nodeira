import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Link } from "@tanstack/react-router";
import { Text } from "@mantine/core";

function WikiLinkView({ node }: NodeViewProps) {
  const { noteId, title } = node.attrs as { noteId: string | null; title: string };

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }} contentEditable={false}>
      {noteId ? (
        <Link to="/notes/$noteId" params={{ noteId }}>
          <Text span c="blue" style={{ textDecoration: "underline", cursor: "pointer" }}>
            [[{title || "Untitled"}]]
          </Text>
        </Link>
      ) : (
        <Text span c="dimmed" ff="monospace">
          [[{title || "Untitled"}]]
        </Text>
      )}
    </NodeViewWrapper>
  );
}

export const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      noteId: { default: null },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-wiki-link]",
        getAttrs: (el) => ({
          noteId: (el as HTMLElement).getAttribute("data-wiki-link") || null,
          title: (el as HTMLElement).getAttribute("data-wiki-title") || "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": node.attrs.noteId ?? "",
        "data-wiki-title": node.attrs.title ?? "",
        class: "wiki-link",
      }),
      `[[${node.attrs.title ?? ""}]]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },
});
