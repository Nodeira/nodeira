import { lazy, Suspense } from "react";
import { Center, Loader } from "@mantine/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authStorage } from "../../lib/authStorage.js";

/**
 * Chrome-less canvas editor embedded by the native Android app's WebView. Mirrors
 * `/embed/note/$noteId`: the native shell injects `window.nodeiraNative` + the JWT before
 * loading this route.
 *
 * Lazy for the same reason as the authenticated canvas route — and this one was the reason
 * that route's laziness bought nothing. A static import here put `CanvasEditor`, `CanvasView`
 * and `@xyflow/react` on the entry path, so Rollup merged them into the main chunk and the
 * dynamic import elsewhere just pointed at code that had already shipped.
 */
const CanvasEditor = lazy(() =>
  import("../../components/canvas/CanvasEditor.js").then((m) => ({ default: m.CanvasEditor })),
);
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
      <Suspense
        fallback={
          <Center h="100%">
            <Loader size="sm" />
          </Center>
        }
      >
        <CanvasEditor canvasId={canvasId} />
      </Suspense>
    </div>
  );
}
