import { lazy, Suspense, type ReactNode } from "react";
import type { CanvasData } from "@nodeira/shared-types";

const ReadOnlyCanvas = lazy(() =>
  import("./ReadOnlyCanvas.js").then((m) => ({ default: m.ReadOnlyCanvas })),
);

/**
 * Renders a canvas read-only, loading React Flow on demand.
 *
 * The canvas *routes* were already lazy, but `@xyflow/react` sat in the entry chunk anyway:
 * the `canvasEmbed` TipTap extension and the canvases-list thumbnail both imported
 * `CanvasView` statically, and the extension has to be registered on every editor mount so
 * that existing documents containing a canvas node still parse. Splitting the schema (which
 * must be eager) from the renderer (which need not be) is what actually moves the dependency.
 */
export function CanvasPreview({ data, fallback }: { data: CanvasData; fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <ReadOnlyCanvas data={data} />
    </Suspense>
  );
}
