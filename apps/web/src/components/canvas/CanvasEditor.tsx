import { Box, Group, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef, useState } from "react";
import { canvasKeys, getCanvas, updateCanvas, uploadImage } from "../../lib/api.js";
import { pickImageFile } from "../../lib/pickImageFile.js";
import { CanvasContextMenu } from "./CanvasContextMenu.js";
import { CanvasToolbar, type AddNodeType } from "./CanvasToolbar.js";
import { CanvasView, type CanvasViewHandle } from "./CanvasView.js";
import { AddNoteModal } from "./AddNoteModal.js";
import { AddLinkModal } from "./AddLinkModal.js";
import type { CanvasData, NoteMetadata, OgPreview } from "@nodeira/shared-types";

/**
 * The canvas editor surface (React Flow board + toolbar + title). Shared by the in-app
 * route (`/canvas/$canvasId`) and the chrome-less `/embed/canvas/$canvasId` route used by
 * the native Android WebView.
 */
export function CanvasEditor({ canvasId }: { canvasId: string }) {
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<CanvasData | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const canvasViewRef = useRef<CanvasViewHandle | null>(null);
  // Every toolbar-triggered add with no explicit position (right-click menu adds do have
  // one) used to land at the same fixed (100, 100), so each new node hid the last one
  // completely until it was dragged aside. Cascades diagonally instead, wrapping so it
  // doesn't wander off the visible canvas after many adds.
  const addCascadeCount = useRef(0);
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

  const scheduleSave = useCallback(
    (data: CanvasData) => {
      latestDataRef.current = data;
      setSaveStatus("idle");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (latestDataRef.current) {
          saveMutation.mutate(latestDataRef.current);
        }
      }, 1500);
    },
    [saveMutation],
  );

  const addNodeViaRef = useCallback(
    (
      type: AddNodeType,
      extraData?: Record<string, unknown>,
      screenX?: number,
      screenY?: number,
    ) => {
      if (screenX !== undefined && screenY !== undefined) {
        canvasViewRef.current?.addNodeAtScreenPos(type, screenX, screenY, extraData);
      } else {
        const offset = (addCascadeCount.current++ % 8) * 24;
        canvasViewRef.current?.addNode(type, 100 + offset, 100 + offset, extraData);
      }
    },
    [],
  );

  /**
   * Adds a node, optionally at a screen position.
   *
   * The toolbar and the right-click menu had one of these each, identical but for whether a
   * position was threaded through — including two copies of the hidden-file-input dance. The
   * position is the only real difference, so it is the only thing that varies here: absent
   * means "wherever the canvas puts a toolbar-created node".
   */
  const handleAdd = useCallback(
    (type: AddNodeType, pos?: { x: number; y: number }) => {
      switch (type) {
        case "file":
          setPendingPos(pos ?? { x: 0, y: 0 });
          setAddNoteOpen(true);
          break;
        case "link":
          setPendingPos(pos ?? { x: 0, y: 0 });
          setAddLinkOpen(true);
          break;
        case "image":
          void pickImageFile().then(async (file) => {
            if (!file) return;
            const { url } = await uploadImage(file);
            addNodeViaRef("image", { url }, pos?.x, pos?.y);
          });
          break;
        default:
          addNodeViaRef(type, {}, pos?.x, pos?.y);
      }
    },
    [addNodeViaRef],
  );

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
        <CanvasToolbar saveStatus={saveStatus} onAddNode={(type) => handleAdd(type)} />

        <ReactFlowProvider>
          <CanvasView ref={canvasViewRef} initialData={canvas.data} onChange={scheduleSave} />
        </ReactFlowProvider>

        {contextMenu && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onAddNode={(type, x, y) => handleAdd(type, { x, y })}
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
