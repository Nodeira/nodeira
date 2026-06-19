import type { NoteMetadata, Vault } from "@nodeira/shared-types";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";

import { ErrorState } from "@/components/ErrorState";
import { NoteContextMenu } from "@/components/NoteContextMenu";
import { TopBar } from "@/components/TopBar";
import { api } from "@/lib/api";

type SortKey = "updated" | "created" | "title";

export default function RecentsScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const { search, vaultId } = useLocalSearchParams<{ search?: string; vaultId?: string }>();
  const [sort, setSort] = useState<SortKey>("updated");
  const [searchText, setSearchText] = useState("");
  const [menuNote, setMenuNote] = useState<NoteMetadata | null>(null);
  // initialVaultId is stable for the lifetime of this screen — store it once in a ref
  const initialVaultId = useRef(vaultId ?? null).current;
  const [filterVaultId, setFilterVaultId] = useState<string | null>(initialVaultId);

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const bgSubtle = dark ? "#25262b" : "#f8f9fa";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";

  const { data: vaults } = useQuery({
    queryKey: ["vaults"],
    queryFn: () => api.get<Vault[]>("/vaults"),
  });

  const {
    data: notes,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["notes", filterVaultId],
    queryFn: () =>
      api.get<NoteMetadata[]>(filterVaultId ? `/notes?vaultId=${filterVaultId}` : "/notes"),
  });

  const activeFilterVault = vaults?.find((v) => v.id === filterVaultId);

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString();
  }

  const sorted = [...(notes ?? [])].sort((a, b) => {
    if (sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (sort === "created")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const query = searchText.trim().toLowerCase();
  const filtered = query
    ? sorted.filter((n) => (n.title || "Untitled").toLowerCase().includes(query))
    : sorted;

  const sortLabel: Record<SortKey, string> = {
    updated: "Date",
    created: "Created",
    title: "Title",
  };

  function cycleSort() {
    setSort((s) => (s === "updated" ? "created" : s === "created" ? "title" : "updated"));
  }

  // Recoverable error screen instead of a silent empty list when the query fails.
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <TopBar
        title="Recent Notes"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onSettings={() => router.push("/settings")}
      />

      {/* Search bar */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: searchText ? "#4263eb" : border,
            backgroundColor: bgSubtle,
          }}
        >
          <Feather name="search" size={15} color={searchText ? "#4263eb" : textMute} />
          <TextInput
            autoFocus={!!search}
            placeholder="Search notes…"
            placeholderTextColor={textMute}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            clearButtonMode="never"
            style={{ flex: 1, fontSize: 14, color: textColor, padding: 0 }}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText("")} hitSlop={8}>
              <Feather name="x-circle" size={15} color={textMute} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sort / filter strip */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bgSubtle,
        }}
      >
        <Pressable
          onPress={cycleSort}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: bg,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "500", color: textColor }}>
            Sort: {sortLabel[sort]}
          </Text>
          <Feather name="chevron-down" size={11} color={textMute} />
        </Pressable>
        <Pressable
          onPress={() => setFilterVaultId((f) => (f ? null : initialVaultId))}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: filterVaultId ? "#4263eb" : border,
            backgroundColor: filterVaultId ? "#edf2ff" : bg,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Feather name="filter" size={13} color={filterVaultId ? "#4263eb" : textMute} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: filterVaultId ? "#4263eb" : textMute,
            }}
          >
            {filterVaultId ? (activeFilterVault?.name ?? "Vault") : "All vaults"}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 12, color: textMute }}>
          {query
            ? `${filtered.length} of ${sorted.length}`
            : `${sorted.length} ${sorted.length === 1 ? "note" : "notes"}`}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4263eb" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={{ paddingTop: 48, alignItems: "center" }}>
              <Feather name="search" size={28} color={textMute} />
              <Text style={{ fontSize: 14, color: textMute, marginTop: 12 }}>
                No notes match &quot;{searchText}&quot;
              </Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <Pressable
              onPress={() => router.push(`/note/${n.id}?title=${encodeURIComponent(n.title)}`)}
              onLongPress={() => setMenuNote(n)}
              delayLongPress={400}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: border,
                backgroundColor: n.pinned ? "#edf2ff" : bg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: n.pinned ? "#4263eb" : textColor,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {n.title || "Untitled"}
                </Text>
                {n.pinned && <Feather name="map-pin" size={14} color="#4263eb" />}
              </View>
              <Text style={{ fontSize: 12, color: textMute, marginBottom: 4 }}>
                {formatDate(n.updatedAt)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <NoteContextMenu
        note={menuNote}
        onClose={() => setMenuNote(null)}
        onEdit={(n) => {
          setMenuNote(null);
          router.push(`/note/${n.id}?title=${encodeURIComponent(n.title)}`);
        }}
      />
    </View>
  );
}
