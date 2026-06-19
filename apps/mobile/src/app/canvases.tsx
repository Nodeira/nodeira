import type { Canvas } from "@nodeira/shared-types";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ErrorState";
import { canvasKeys, createCanvas, deleteCanvas, getCanvases } from "@/lib/api";

export default function CanvasesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const dark = useColorScheme() === "dark";
  const { vaultId } = useLocalSearchParams<{ vaultId?: string }>();

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const bgSubtle = dark ? "#25262b" : "#f8f9fa";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";

  const [menuCanvas, setMenuCanvas] = useState<Canvas | null>(null);

  const {
    data: canvases,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...canvasKeys.all, vaultId ?? null],
    queryFn: () => getCanvases(vaultId),
  });

  const createMutation = useMutation({
    mutationFn: () => createCanvas({ title: "Untitled Canvas", vaultId: vaultId ?? null }),
    onSuccess: (canvas) => {
      void qc.invalidateQueries({ queryKey: canvasKeys.all, exact: true });
      router.push(`/canvas/${canvas.id}` as "/");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCanvas(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: canvasKeys.all, exact: true });
      setMenuCanvas(null);
    },
  });

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString();
  }

  function confirmDelete(canvas: Canvas) {
    Alert.alert("Delete Canvas", `Delete "${canvas.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(canvas.id),
      },
    ]);
  }

  if (isError) return <ErrorState onRetry={refetch} title="Failed to load canvases" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={20} color={textColor} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: textColor, flex: 1 }}>Canvases</Text>
        <Pressable
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          hitSlop={8}
        >
          <Feather name="plus" size={22} color="#4263eb" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#4263eb" />
        </View>
      ) : canvases?.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 32,
            gap: 12,
          }}
        >
          <Feather name="layout" size={40} color={textMute} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: textColor }}>No canvases yet</Text>
          <Text style={{ fontSize: 14, color: textMute, textAlign: "center" }}>
            Create a canvas to start building visual boards and diagrams.
          </Text>
          <Pressable
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            style={{
              marginTop: 8,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              backgroundColor: "#4263eb",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Create Canvas</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={canvases}
          keyExtractor={(c) => c.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/canvas/${item.id}` as "/")}
              onLongPress={() => setMenuCanvas(item)}
              delayLongPress={400}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 12,
                backgroundColor: bgSubtle,
                borderWidth: 1,
                borderColor: border,
                gap: 8,
                minHeight: 120,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {item.icon ? (
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                ) : (
                  <Feather name="layout" size={18} color="#4263eb" />
                )}
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }} numberOfLines={2}>
                {item.title || "Untitled Canvas"}
              </Text>
              <Text style={{ fontSize: 11, color: textMute }}>
                {item.data.nodes.length} {item.data.nodes.length === 1 ? "node" : "nodes"}
              </Text>
              <Text style={{ fontSize: 11, color: textMute }}>{formatDate(item.updatedAt)}</Text>
            </Pressable>
          )}
        />
      )}

      {/* Long-press context menu */}
      <Modal
        visible={!!menuCanvas}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuCanvas(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setMenuCanvas(null)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
              paddingTop: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: border,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: textColor,
                paddingHorizontal: 20,
                paddingBottom: 16,
              }}
            >
              {menuCanvas?.title}
            </Text>
            <Pressable
              onPress={() => {
                if (menuCanvas) confirmDelete(menuCanvas);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 14,
              }}
            >
              <Feather name="trash-2" size={18} color="#e03131" />
              <Text style={{ fontSize: 15, color: "#e03131" }}>Delete Canvas</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
