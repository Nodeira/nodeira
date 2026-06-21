import { createFileRoute, redirect } from "@tanstack/react-router";
import { CanvasEditor } from "../../components/canvas/CanvasEditor.js";
import { authStorage } from "../../lib/authStorage.js";

/**
 * Chrome-less canvas editor embedded by the native Android app's WebView. Mirrors
 * `/embed/note/$noteId`: the native shell injects `window.nodeiraNative` + the JWT before
 * loading this route.
 */
export const Route = createFileRoute("/embed/canvas/$canvasId")({
  beforeLoad: () => {
    if (!authStorage.getToken()) {
      throw redirect({ to: "/login" });
    }
  },
  component: EmbeddedCanvasEditor,
});

function EmbeddedCanvasEditor() {
  const { canvasId } = Route.useParams();
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <CanvasEditor canvasId={canvasId} />
    </div>
  );
}
