import { useState, useCallback, lazy, Suspense } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ActionIcon, Box, Group, Loader, Text } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconFileTypePdf,
} from "@tabler/icons-react";
import { useAttachmentUrl } from "../lib/attachments.js";

// react-pdf and pdfjs-dist are over a megabyte together, and this extension is registered on
// every editor mount so that a document containing a pdfEmbed node still parses. The schema
// has to be eager; the renderer does not.
const PdfViewer = lazy(() => import("./PdfViewer.js").then((m) => ({ default: m.PdfViewer })));

function PdfSpinner() {
  return (
    <Box p="xl" style={{ display: "flex", justifyContent: "center" }}>
      <Loader size="sm" />
    </Box>
  );
}

function PdfEmbedView({ node }: NodeViewProps) {
  const { src, title } = node.attrs as { src: string; title: string };
  // `src` stays the stored `/uploads/<uuid>.pdf`; this is the fetchable form of it.
  const resolved = useAttachmentUrl(src);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(false);

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  }, []);

  return (
    <NodeViewWrapper>
      {/* Hidden content slot — keeps Yjs's Y.XmlText child in sync with ProseMirror */}
      <NodeViewContent style={{ display: "none" }} />
      <Box
        style={{
          border: "1px solid var(--mantine-color-default-border)",
          borderRadius: "var(--mantine-radius-sm)",
          overflow: "hidden",
          display: "inline-flex",
          flexDirection: "column",
          maxWidth: "100%",
        }}
      >
        {/* Header bar */}
        <Group
          px="sm"
          py={6}
          gap="xs"
          style={{
            background: "var(--mantine-color-default-hover)",
            borderBottom: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <IconFileTypePdf size={16} color="var(--mantine-color-red-6)" />
          <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
            {title}
          </Text>
          <ActionIcon
            size="xs"
            variant="subtle"
            title="Open PDF in new tab"
            disabled={!resolved}
            onClick={(e) => {
              e.stopPropagation();
              if (resolved) window.open(resolved, "_blank", "noopener,noreferrer");
            }}
          >
            <IconExternalLink size={14} />
          </ActionIcon>
          {numPages !== null && (
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                size="xs"
                variant="subtle"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                title="Previous page"
              >
                <IconChevronLeft size={14} />
              </ActionIcon>
              <Text size="xs" c="dimmed" style={{ minWidth: 60, textAlign: "center" }}>
                {pageNumber} / {numPages}
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                title="Next page"
              >
                <IconChevronRight size={14} />
              </ActionIcon>
            </Group>
          )}
        </Group>

        {/* PDF canvas */}
        <Box style={{ maxHeight: "70vh", overflow: "auto", background: "#525659" }}>
          {resolved === undefined ? (
            <PdfSpinner />
          ) : (
            // The same spinner covers fetching the ticket, loading the viewer chunk and
            // pdf.js parsing the document, so the three stages read as one wait.
            <Suspense fallback={<PdfSpinner />}>
              <PdfViewer
                src={resolved}
                pageNumber={pageNumber}
                onLoadSuccess={onLoadSuccess}
                onLoadError={() => setError(true)}
                failed={error}
              />
            </Suspense>
          )}
        </Box>
      </Box>
    </NodeViewWrapper>
  );
}

export const PdfEmbed = Node.create({
  name: "pdfEmbed",
  group: "block",
  content: "text*",
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: "Document.pdf" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-pdf-embed="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-pdf-embed": "true" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PdfEmbedView);
  },
});
