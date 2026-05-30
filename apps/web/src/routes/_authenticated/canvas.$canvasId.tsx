import { Box, Group, TextInput, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef, useState } from "react";
import { canvasKeys, getCanvas, updateCanvas, uploadImage } from "../../lib/api.js";
import { CanvasContextMenu } from "../../components/canvas/CanvasContextMenu.js";
import { CanvasToolbar, type AddNodeType } from "../../components/canvas/CanvasToolbar.js";
import { CanvasView, type CanvasViewHandle } from "../../components/canvas/CanvasView.js";
import { AddNoteModal } from "../../components/canvas/AddNoteModal.js";
import { AddLinkModal } from "../../components/canvas/AddLinkModal.js";
import type { CanvasData, NoteMetadata, OgPreview } from "@nodeira/shared-types";

export const Route = createFileRoute("/_authenticated/canvas/$canvasId")({
  component: CanvasEditorPage,
});

function CanvasEditorPage() {
  const { canvasId } = Route.useParams();
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<CanvasData | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const canvasViewRef = useRef<CanvasViewHandle | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { data: canvas, isLoading } = useQuery({
    queryKey: canvasKeys.detail(canvasId),
    queryFn: () => getCanvas(canvasId),
  });

  const saveMutation = useMutation({
    mutationFn: (data: CanvasData) => updateCanvas(canvasId, { data }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      // Invalidate only the list query, not the detail — prevents position reset via refetch
      void queryClient.invalidateQueries({ queryKey: canvasKeys.all, exact: true });
    },
  });

  const saveTitleMutation = useMutation({
    mutationFn: (title: string) => updateCanvas(canvasId, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: canvasKeys.detail(canvasId) });
      void queryClient.invalidateQueries({ queryKey: canvasKeys.all, exact: true });
    },
  });

  const scheduleSave = useCallback((data: CanvasData) => {
    latestDataRef.current = data;
    setSaveStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (latestDataRef.current) {
        saveMutation.mutate(latestDataRef.current);
      }
    }, 1500);
  }, [saveMutation]);

  const addNodeViaRef = useCallback(
    (type: AddNodeType, extraData?: Record<string, unknown>, screenX?: number, screenY?: number) => {
      if (screenX !== undefined && screenY !== undefined) {
        canvasViewRef.current?.addNodeAtScreenPos(type, screenX, screenY, extraData);
      } else {
        canvasViewRef.current?.addNode(type, 100, 100, extraData);
      }
    },
    [],
  );

  const handleToolbarAdd = useCallback((type: AddNodeType) => {
    if (type === "file") {
      setPendingPos({ x: 0, y: 0 });
      setAddNoteOpen(true);
    } else if (type === "link") {
      setPendingPos({ x: 0, y: 0 });
      setAddLinkOpen(true);
    } else if (type === "image") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const { url } = await uploadImage(file);
        addNodeViaRef("image", { url });
      };
      input.click();
    } else {
      addNodeViaRef(type);
    }
  }, [addNodeViaRef]);

  const handleContextAdd = useCallback((type: AddNodeType, screenX: number, screenY: number) => {
    if (type === "file") {
      setPendingPos({ x: screenX, y: screenY });
      setAddNoteOpen(true);
    } else if (type === "link") {
      setPendingPos({ x: screenX, y: screenY });
      setAddLinkOpen(true);
    } else if (type === "image") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const { url } = await uploadImage(file);
        addNodeViaRef("image", { url }, screenX, screenY);
      };
      input.click();
    } else {
      addNodeViaRef(type, {}, screenX, screenY);
    }
  }, [addNodeViaRef]);

  const handleNoteSelect = (note: NoteMetadata) => {
    const hasScreenPos = pendingPos.x !== 0 || pendingPos.y !== 0;
    addNodeViaRef(
      "file",
      { file: note.id },
      hasScreenPos ? pendingPos.x : undefined,
      hasScreenPos ? pendingPos.y : undefined,
    );
  };

  const handleLinkConfirm = (url: string, preview: OgPreview) => {
    const hasScreenPos = pendingPos.x !== 0 || pendingPos.y !== 0;
    addNodeViaRef(
      "link",
      { url, preview },
      hasScreenPos ? pendingPos.x : undefined,
      hasScreenPos ? pendingPos.y : undefined,
    );
  };

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== canvas?.title) {
      saveTitleMutation.mutate(trimmed);
    }
  };

  if (isLoading || !canvas) {
    return <Box p="md">Loading canvas…</Box>;
  }

  return (
    <Box
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => setContextMenu(null)}
    >
      <Group
        px="md"
        py="xs"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        {editingTitle ? (
          <TextInput
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.currentTarget.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleBlur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            autoFocus
            size="xs"
            styles={{ input: { fontWeight: 600 } }}
          />
        ) : (
          <Title
            order={5}
            style={{ fontWeight: 600, cursor: "text" }}
            onClick={(e) => {
              e.stopPropagation();
              setTitleDraft(canvas.title);
              setEditingTitle(true);
            }}
            title="Click to rename"
          >
            {canvas.title}
          </Title>
        )}
      </Group>

      <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <CanvasToolbar saveStatus={saveStatus} onAddNode={handleToolbarAdd} />

        <ReactFlowProvider>
          <CanvasView
            ref={canvasViewRef}
            initialData={canvas.data}
            onChange={scheduleSave}
          />
        </ReactFlowProvider>

        {contextMenu && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onAddNode={handleContextAdd}
          />
        )}
      </Box>

      <AddNoteModal
        opened={addNoteOpen}
        onClose={() => setAddNoteOpen(false)}
        onSelect={handleNoteSelect}
      />
      <AddLinkModal
        opened={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        onConfirm={handleLinkConfirm}
      />
    </Box>
  );
}
