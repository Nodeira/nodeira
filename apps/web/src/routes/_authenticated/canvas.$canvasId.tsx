import { lazy, Suspense } from "react";
import { Center, Loader } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

// @xyflow/react and its stylesheet are only needed on canvas screens, so they load with
// the route rather than sitting in the entry chunk of every page.
const CanvasEditor = lazy(() =>
  import("../../components/canvas/CanvasEditor.js").then((m) => ({ default: m.CanvasEditor })),
);

export const Route = createFileRoute("/_authenticated/canvas/$canvasId")({
  component: CanvasEditorPage,
});

function CanvasEditorPage() {
  const { canvasId } = Route.useParams();
  return (
    <Suspense
      fallback={
        <Center h="100%">
          <Loader size="sm" />
        </Center>
      }
    >
      <CanvasEditor canvasId={canvasId} />
    </Suspense>
  );
}
