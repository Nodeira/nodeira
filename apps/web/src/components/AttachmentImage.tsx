import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useAttachmentUrl } from "../lib/attachments.js";

/**
 * Renders the resolved, authenticated URL while leaving `src` in the document alone.
 *
 * Doing this in a node view rather than in `renderHTML` is deliberate: `renderHTML` output
 * round-trips back through `parseHTML` on copy/paste and `setContent`, which would write a
 * ticket-bearing URL into the Yjs document and bake a one-hour credential into the note
 * forever. A node view is display-only — `node.attrs.src` stays `/uploads/<uuid>.<ext>`.
 */
function AttachmentImageView({ node, selected }: NodeViewProps) {
  const { src, alt, title } = node.attrs as {
    src: string;
    alt: string | null;
    title: string | null;
  };
  const resolved = useAttachmentUrl(src);

  return (
    <NodeViewWrapper as="div" data-drag-handle>
      {resolved === undefined ? (
        // The ticket is still in flight. An empty box holds the line's height without the
        // browser's broken-image glyph flashing in and out on every editor mount.
        <div
          aria-hidden
          style={{
            height: 120,
            borderRadius: 6,
            background: "var(--mantine-color-default-hover)",
          }}
        />
      ) : (
        <img
          src={resolved}
          alt={alt ?? ""}
          title={title ?? undefined}
          style={{
            maxWidth: "100%",
            height: "auto",
            display: "block",
            borderRadius: 6,
            outline: selected ? "2px solid var(--mantine-primary-color-filled)" : undefined,
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

/** Drop-in replacement for `@tiptap/extension-image`. Same schema, resolved rendering. */
export const AttachmentImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentImageView);
  },
});
