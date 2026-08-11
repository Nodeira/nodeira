import { Document, Page, pdfjs } from "react-pdf";
import { Box, Loader, Text } from "@mantine/core";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
// ?url tells Vite to resolve the npm package path and return the correct asset URL.
// new URL('bare-specifier', import.meta.url) only works for local relative paths in Vite.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  src: string;
  pageNumber: number;
  onLoadSuccess: (info: { numPages: number }) => void;
  onLoadError: () => void;
  failed: boolean;
}

/**
 * The pdf.js-backed page renderer, kept in its own module so `react-pdf` and `pdfjs-dist`
 * load only for a note that actually contains a PDF.
 *
 * They used to sit in the entry chunk: `PdfEmbed` is a TipTap extension, and every editor
 * mount registers it so documents containing a `pdfEmbed` node still parse. Registering the
 * schema does not need the renderer, though — only rendering does. Import this through
 * `PdfEmbed`'s lazy boundary, never statically from the editor.
 *
 * Deliberately controlled rather than stateful: the page number and title live in the embed's
 * header bar, which stays in the eager chunk, so this owns no state of its own.
 */
export function PdfViewer({ src, pageNumber, onLoadSuccess, onLoadError, failed }: PdfViewerProps) {
  if (failed) {
    return (
      <Box p="md">
        <Text size="sm" c="red">
          Failed to load PDF.
        </Text>
      </Box>
    );
  }

  return (
    <Document
      file={src}
      onLoadSuccess={onLoadSuccess}
      onLoadError={onLoadError}
      loading={
        <Box p="xl" style={{ display: "flex", justifyContent: "center" }}>
          <Loader size="sm" />
        </Box>
      }
    >
      <Page pageNumber={pageNumber} width={700} renderAnnotationLayer renderTextLayer />
    </Document>
  );
}
