import { createFileRoute } from "@tanstack/react-router";
import { CanvasEditor } from "../../components/canvas/CanvasEditor.js";

export const Route = createFileRoute("/_authenticated/canvas/$canvasId")({
  component: CanvasEditorPage,
});

function CanvasEditorPage() {
  const { canvasId } = Route.useParams();
  return <CanvasEditor canvasId={canvasId} />;
}
