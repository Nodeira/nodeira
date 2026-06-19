import type { CanvasData, NoteMetadata, OgPreview } from "@nodeira/shared-types";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CanvasView, type CanvasViewHandle } from "@/components/canvas/CanvasView";
import { CanvasAddSheet } from "@/components/canvas/CanvasAddSheet";
import { AddNoteModal } from "@/components/canvas/AddNoteModal";
import { AddLinkModal } from "@/components/canvas/AddLinkModal";
import { ErrorState } from "@/components/ErrorState";
import { canvasKeys, fetchUrlPreview, getCanvas, updateCanvas, uploadImage } from "@/lib/api";
import * as ImagePicker from "expo-image-picker";

export default function CanvasEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const dark = useColorScheme() === "dark";

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<CanvasData | null>(null);
  const canvasViewRef = useRef<CanvasViewHandle | null>(null);

  const {
    data: canvas,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: canvasKeys.detail(id),
    queryFn: () => getCanvas(id),
  });

  const saveMutation = useMutation({
    mutationFn: (data: CanvasData) => updateCanvas(id, { data }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      void qc.invalidateQueries({ queryKey: canvasKeys.all, exact: true });
    },
  });

  const saveTitleMutation = useMutation({
    mutationFn: (title: string) => updateCanvas(id, { title }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: canvasKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: canvasKeys.all, exact: true });
    },
  });

  const scheduleSave = useCallback(
    (data: CanvasData) => {
      latestDataRef.current = data;
      setSaveStatus("idle");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (latestDataRef.current) saveMutation.mutate(latestDataRef.current);
      }, 1500);
    },
    [saveMutation],
  );

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== canvas?.title) {
      saveTitleMutation.mutate(trimmed);
    }
  };

  const handleAddNode = useCallback(async (type: string) => {
    setAddSheetOpen(false);
    if (type === "text") {
      canvasViewRef.current?.addNode("text", 100, 100, { text: "" });
    } else if (type === "file") {
      setAddNoteOpen(true);
    } else if (type === "link") {
      setAddLinkOpen(true);
    } else if (type === "group") {
      canvasViewRef.current?.addNode("group", 100, 100, { label: "Group" });
    } else if (type === "image") {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const { url } = await uploadImage(result.assets[0].uri);
        canvasViewRef.current?.addNode("image", 100, 100, { url });
      }
    }
  }, []);

  const handleNoteSelect = (note: NoteMetadata) => {
    setAddNoteOpen(false);
    canvasViewRef.current?.addNode("file", 100, 100, { file: note.id });
  };

  const handleLinkConfirm = (url: string, preview: OgPreview) => {
    setAddLinkOpen(false);
    canvasViewRef.current?.addNode("link", 100, 100, { url, preview });
  };

  if (isError) return <ErrorState onRetry={refetch} title="Failed to load canvas" />;

  if (isLoading || !canvas) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: bg, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#4263eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={20} color={textColor} />
        </Pressable>

        {editingTitle ? (
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={handleTitleBlur}
            onSubmitEditing={handleTitleBlur}
            autoFocus
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: "600",
              color: textColor,
              borderBottomWidth: 1,
              borderBottomColor: "#4263eb",
              paddingVertical: 2,
            }}
          />
        ) : (
          <Pressable
            onPress={() => {
              setTitleDraft(canvas.title);
              setEditingTitle(true);
            }}
            style={{ flex: 1 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: textColor }} numberOfLines={1}>
              {canvas.title}
            </Text>
          </Pressable>
        )}

        <Text style={{ fontSize: 11, color: "#868e96", marginLeft: 8 }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : ""}
        </Text>
      </View>

      {/* Canvas */}
      <View style={{ flex: 1 }}>
        <CanvasView ref={canvasViewRef} initialData={canvas.data} onChange={scheduleSave} />

        {/* FAB */}
        <Pressable
          onPress={() => setAddSheetOpen(true)}
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "#4263eb",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>
      </View>

      <CanvasAddSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={handleAddNode}
      />

      <AddNoteModal
        visible={addNoteOpen}
        onClose={() => setAddNoteOpen(false)}
        onSelect={handleNoteSelect}
      />

      <AddLinkModal
        visible={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        onConfirm={handleLinkConfirm}
        fetchPreview={fetchUrlPreview}
      />
    </SafeAreaView>
  );
}
