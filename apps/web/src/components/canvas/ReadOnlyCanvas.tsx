import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CanvasData } from "@nodeira/shared-types";
import { CanvasView } from "./CanvasView.js";

/**
 * A non-interactive canvas render.
 *
 * Deliberately the *only* module outside the canvas editor route that reaches for
 * `@xyflow/react`, so that everything it drags in lands in one lazily-loaded chunk. Import it
 * through `CanvasPreview`, never directly — a static import from anywhere on the entry path
 * puts React Flow straight back into the main bundle.
 */
export function ReadOnlyCanvas({ data }: { data: CanvasData }) {
  return (
    <ReactFlowProvider>
      <CanvasView initialData={data} readOnly />
    </ReactFlowProvider>
  );
}
