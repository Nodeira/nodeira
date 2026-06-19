import type { Folder, NoteMetadata, Vault } from "@nodeira/shared-types";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";

import { ErrorState } from "@/components/ErrorState";
import { MenuDrawer } from "@/components/MenuDrawer";
import { NoteContextMenu } from "@/components/NoteContextMenu";
import { TopBar } from "@/components/TopBar";
import { api } from "@/lib/api";

interface RecentFileTreeProps {
  notes: NoteMetadata[];
  folders: Folder[];
  dark: boolean;
  bg: string;
  bgSubtle: string;
  border: string;
  textColor: string;
  textMute: string;
  onPress: (n: NoteMetadata) => void;
  onLongPress: (n: NoteMetadata) => void;
  formatDate: (d: Date | string) => string;
}

function RecentFileTree({
  notes,
  folders,
  dark,
  bg,
  bgSubtle,
  border,
  textColor,
  textMute,
  onPress,
  onLongPress,
  formatDate,
}: RecentFileTreeProps) {
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  // Group notes by folderId so consecutive same-folder notes share one folder row
  type Row =
    | { kind: "folder"; folder: Folder }
    | { kind: "note"; note: NoteMetadata; indented: boolean };

  const rows: Row[] = [];
  let lastFolderId: string | null | undefined = undefined;

  for (const note of notes) {
    const folder = note.folderId ? folderMap.get(note.folderId) : null;
    if (note.folderId !== lastFolderId) {
      if (folder) rows.push({ kind: "folder", folder });
      lastFolderId = note.folderId;
    }
    rows.push({ kind: "note", note, indented: !!folder });
  }

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {rows.map((row, i) => {
        if (row.kind === "folder") {
          return (
            <View
              key={`folder-${row.folder.id}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingHorizontal: 10,
                paddingTop: i === 0 ? 0 : 8,
                paddingBottom: 3,
              }}
            >
              <Feather name="folder" size={13} color={textMute} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: textMute }} numberOfLines={1}>
                {row.folder.name}
              </Text>
            </View>
          );
        }
        const n = row.note;
        return (
          <Pressable
            key={n.id}
            onPress={() => onPress(n)}
            onLongPress={() => onLongPress(n)}
            delayLongPress={400}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 9,
              marginLeft: row.indented ? 20 : 0,
              borderRadius: 8,
              marginBottom: 2,
              backgroundColor: pressed ? bgSubtle : "transparent",
            })}
          >
            <Feather
              name={n.type === "quick" ? "zap" : "file-text"}
              size={14}
              color={n.pinned ? "#4263eb" : textMute}
            />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: n.pinned ? "#4263eb" : textColor,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {n.title || "Untitled"}
            </Text>
            <Text style={{ fontSize: 11, color: textMute, fontVariant: ["tabular-nums"] }}>
              {formatDate(n.updatedAt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const dark = useColorScheme() === "dark";

  const bg = dark ? "#1a1b1e" : "#ffffff";
  const bgSubtle = dark ? "#25262b" : "#f8f9fa";
  const border = dark ? "#373a40" : "#e9ecef";
  const textColor = dark ? "#c1c2c5" : "#212529";
  const textMute = "#868e96";

  const [menuOpen, setMenuOpen] = useState(false);
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const [menuNote, setMenuNote] = useState<NoteMetadata | null>(null);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [addingVault, setAddingVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard height so bottom-sheet inputs can lift above it (RN Modals
  // don't get the system's soft-input resize, so the keyboard would cover them).
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function closeNewMenu() {
    setNewMenuOpen(false);
    setAddingFolder(false);
    setNewFolderName("");
  }

  function closeVaultMenu() {
    setVaultMenuOpen(false);
    setAddingVault(false);
    setNewVaultName("");
  }

  const { data: vaults } = useQuery({
    queryKey: ["vaults"],
    queryFn: () => api.get<Vault[]>("/vaults"),
  });

  const { data: folders } = useQuery({
    queryKey: ["folders", activeVaultId],
    queryFn: () =>
      api.get<Folder[]>(activeVaultId ? `/folders?vaultId=${activeVaultId}` : "/folders"),
  });

  const {
    data: notes,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["notes", activeVaultId],
    queryFn: () =>
      api.get<NoteMetadata[]>(activeVaultId ? `/notes?vaultId=${activeVaultId}` : "/notes"),
  });

  const createNote = useMutation({
    mutationFn: (type: "note" | "quick" = "note") =>
      api.post<NoteMetadata>("/notes", {
        title: "Untitled",
        type,
        ...(activeVaultId ? { vaultId: activeVaultId } : {}),
      }),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      closeNewMenu();
      router.push(`/note/${note.id}?title=${encodeURIComponent(note.title)}&type=${note.type}`);
    },
  });

  const createFolder = useMutation({
    mutationFn: (name: string) =>
      api.post<Folder>("/folders", {
        name,
        ...(activeVaultId ? { vaultId: activeVaultId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      closeNewMenu();
    },
  });

  const createVault = useMutation({
    mutationFn: (name: string) => api.post<Vault>("/vaults", { name }),
    onSuccess: (vault) => {
      qc.invalidateQueries({ queryKey: ["vaults"] });
      setActiveVaultId(vault.id);
      closeVaultMenu();
    },
  });

  const activeVault = vaults?.find((v) => v.id === activeVaultId);
  const vaultDisplayName = activeVault?.name ?? "All vaults";

  const pinned = notes?.filter((n) => n.pinned) ?? [];
  const quickNotes = notes?.filter((n) => n.type === "quick") ?? [];
  const recent = notes?.filter((n) => !n.pinned && n.type !== "quick").slice(0, 3) ?? [];
  const totalCount = notes?.length ?? 0;

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString();
  }

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}
      >
        <ActivityIndicator size="large" color="#4263eb" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <TopBar onMenu={() => setMenuOpen(true)} onSettings={() => router.push("/settings")} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#4263eb"
            colors={["#4263eb"]}
          />
        }
      >
        {/* Vault chip */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
          <Pressable
            onPress={() => setVaultMenuOpen(true)}
            style={{
              padding: 14,
              borderRadius: 10,
              backgroundColor: bgSubtle,
              borderWidth: 1,
              borderColor: border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#4263eb",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {(activeVault?.name ?? "A")[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: textColor }}>
                {vaultDisplayName}
              </Text>
              <Text style={{ fontSize: 12, color: textMute, marginTop: 1 }}>
                {totalCount} {totalCount === 1 ? "note" : "notes"} · synced
              </Text>
            </View>
            <Feather name="chevron-down" size={14} color={textMute} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Pressable
            onPress={() =>
              router.push(`/recents?search=true${activeVaultId ? `&vaultId=${activeVaultId}` : ""}`)
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <Feather name="search" size={16} color={textMute} />
            <Text style={{ fontSize: 14, color: textMute }}>Search…</Text>
          </Pressable>
        </View>

        {/* + New button */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
          <Pressable
            onPress={() => setNewMenuOpen(true)}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 8,
              backgroundColor: "#edf2ff",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Feather name="plus" size={14} color="#4263eb" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#4263eb" }}>New</Text>
            <Feather name="chevron-down" size={14} color="#4263eb" />
          </Pressable>
        </View>

        {/* Quick Notes */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Pressable
            onPress={() =>
              activeVaultId
                ? router.push(`/quick-notes?vaultId=${activeVaultId}`)
                : router.push("/quick-notes")
            }
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Feather name="zap" size={14} color="#4263eb" />
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#4263eb", flex: 1 }}>
              Quick Notes
            </Text>
          </Pressable>
        </View>

        {/* Canvases + Graph row */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() =>
              activeVaultId
                ? router.push(`/canvases?vaultId=${activeVaultId}` as "/")
                : router.push("/canvases" as "/")
            }
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Feather name="layout" size={14} color="#4263eb" />
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#4263eb" }}>Canvases</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/graph" as "/")}
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Feather name="share-2" size={14} color="#4263eb" />
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#4263eb" }}>Graph</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/reminders" as "/")}
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Feather name="bell" size={14} color="#4263eb" />
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#4263eb" }}>Reminders</Text>
          </Pressable>
        </View>

        {/* Pinned section */}
        {pinned.length > 0 && (
          <>
            <Text
              style={{
                paddingHorizontal: 22,
                paddingBottom: 8,
                fontSize: 11,
                color: textMute,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                fontWeight: "600",
              }}
            >
              Pinned
            </Text>
            <View style={{ paddingHorizontal: 16, gap: 4 }}>
              {pinned.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() =>
                    router.push(`/note/${n.id}?title=${encodeURIComponent(n.title)}&type=${n.type}`)
                  }
                  onLongPress={() => setMenuNote(n)}
                  delayLongPress={400}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderRadius: 8,
                    backgroundColor: "#edf2ff",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Feather name="file-text" size={14} color="#4263eb" />
                  <Text
                    style={{ fontSize: 15, fontWeight: "500", color: "#4263eb", flex: 1 }}
                    numberOfLines={1}
                  >
                    {n.title || "Untitled"}
                  </Text>
                  <Feather name="map-pin" size={14} color="#4263eb" />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Recent Notes section */}
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: pinned.length > 0 ? 18 : 0,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: textMute,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              fontWeight: "600",
              flex: 1,
            }}
          >
            Recent Notes
          </Text>
          <Pressable
            onPress={() =>
              activeVaultId
                ? router.push(`/recents?vaultId=${activeVaultId}`)
                : router.push("/recents")
            }
            hitSlop={8}
          >
            <Text style={{ fontSize: 13, fontWeight: "500", color: "#4263eb" }}>See all</Text>
          </Pressable>
        </View>

        {recent.length === 0 && notes?.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable
              onPress={() => createNote.mutate("note")}
              style={{
                paddingVertical: 24,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: border,
                borderStyle: "dashed",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, color: textMute }}>No notes yet</Text>
              <Text style={{ fontSize: 13, color: "#4263eb", fontWeight: "500" }}>
                Create your first note
              </Text>
            </Pressable>
          </View>
        ) : (
          <RecentFileTree
            notes={recent}
            folders={folders ?? []}
            dark={dark}
            bg={bg}
            bgSubtle={bgSubtle}
            border={border}
            textColor={textColor}
            textMute={textMute}
            onPress={(n) =>
              router.push(`/note/${n.id}?title=${encodeURIComponent(n.title)}&type=${n.type}`)
            }
            onLongPress={(n) => setMenuNote(n)}
            formatDate={formatDate}
          />
        )}
      </ScrollView>

      <MenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />

      <NoteContextMenu
        note={menuNote}
        onClose={() => setMenuNote(null)}
        onEdit={(n) => {
          setMenuNote(null);
          router.push(`/note/${n.id}?title=${encodeURIComponent(n.title)}&type=${n.type}`);
        }}
      />

      {/* Vault picker bottom sheet */}
      <Modal
        visible={vaultMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={closeVaultMenu}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={closeVaultMenu}
        >
          {/* Inner Pressable absorbs taps on the sheet so they don't close the modal */}
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
              marginBottom: keyboardHeight,
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: border,
                alignSelf: "center",
                marginTop: 12,
                marginBottom: 16,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: textColor, flex: 1 }}>
                Vaults
              </Text>
              <Pressable onPress={closeVaultMenu} hitSlop={8}>
                <Feather name="x" size={18} color={textMute} />
              </Pressable>
            </View>

            {/* "All vaults" option */}
            <Pressable
              onPress={() => {
                setActiveVaultId(null);
                closeVaultMenu();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 14,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 7,
                  backgroundColor: activeVaultId === null ? "#4263eb" : bgSubtle,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name="layers"
                  size={14}
                  color={activeVaultId === null ? "#fff" : textMute}
                />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: activeVaultId === null ? "600" : "400",
                  color: activeVaultId === null ? "#4263eb" : textColor,
                  flex: 1,
                }}
              >
                All vaults
              </Text>
              {activeVaultId === null && <Feather name="check" size={16} color="#4263eb" />}
            </Pressable>

            {/* Vault list */}
            {vaults?.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => {
                  setActiveVaultId(v.id);
                  closeVaultMenu();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: border,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    backgroundColor: activeVaultId === v.id ? "#4263eb" : bgSubtle,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: activeVaultId === v.id ? "#fff" : textMute,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {v.name[0].toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: activeVaultId === v.id ? "600" : "400",
                    color: activeVaultId === v.id ? "#4263eb" : textColor,
                    flex: 1,
                  }}
                >
                  {v.name}
                </Text>
                {activeVaultId === v.id && <Feather name="check" size={16} color="#4263eb" />}
              </Pressable>
            ))}

            {/* Add vault */}
            {addingVault ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
                <TextInput
                  autoFocus
                  placeholder="Vault name"
                  placeholderTextColor={textMute}
                  value={newVaultName}
                  onChangeText={setNewVaultName}
                  style={{
                    height: 42,
                    borderWidth: 1,
                    borderColor: "#4263eb",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 15,
                    color: textColor,
                    backgroundColor: bgSubtle,
                  }}
                  onSubmitEditing={() => {
                    if (newVaultName.trim()) createVault.mutate(newVaultName.trim());
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setAddingVault(false);
                      setNewVaultName("");
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: textMute }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (newVaultName.trim()) createVault.mutate(newVaultName.trim());
                    }}
                    disabled={!newVaultName.trim() || createVault.isPending}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: newVaultName.trim() ? "#4263eb" : bgSubtle,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: newVaultName.trim() ? "#fff" : textMute,
                      }}
                    >
                      {createVault.isPending ? "Creating…" : "Create"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setAddingVault(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    backgroundColor: bgSubtle,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: border,
                    borderStyle: "dashed",
                  }}
                >
                  <Feather name="plus" size={14} color={textMute} />
                </View>
                <Text style={{ fontSize: 15, color: textMute }}>Add vault</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* New item bottom sheet */}
      <Modal visible={newMenuOpen} transparent animationType="slide" onRequestClose={closeNewMenu}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={closeNewMenu}
        >
          {/* Inner Pressable absorbs taps on the sheet so they don't close the modal */}
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
              marginBottom: keyboardHeight,
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: border,
                alignSelf: "center",
                marginTop: 12,
                marginBottom: 8,
              }}
            />

            {addingFolder ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: textColor,
                    textAlign: "center",
                  }}
                >
                  New folder
                </Text>
                <TextInput
                  autoFocus
                  placeholder="Folder name"
                  placeholderTextColor={textMute}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  style={{
                    height: 42,
                    borderWidth: 1,
                    borderColor: "#4263eb",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 15,
                    color: textColor,
                    backgroundColor: bgSubtle,
                  }}
                  onSubmitEditing={() => {
                    if (newFolderName.trim()) createFolder.mutate(newFolderName.trim());
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setAddingFolder(false);
                      setNewFolderName("");
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: textMute }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (newFolderName.trim()) createFolder.mutate(newFolderName.trim());
                    }}
                    disabled={!newFolderName.trim() || createFolder.isPending}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: newFolderName.trim() ? "#4263eb" : bgSubtle,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: newFolderName.trim() ? "#fff" : textMute,
                      }}
                    >
                      {createFolder.isPending ? "Creating…" : "Create"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ paddingTop: 4 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: textColor,
                    textAlign: "center",
                    paddingBottom: 8,
                  }}
                >
                  Create new
                </Text>
                {[
                  {
                    label: "New note",
                    icon: "file-text" as const,
                    onPress: () => createNote.mutate("note"),
                  },
                  {
                    label: "New quick note",
                    icon: "zap" as const,
                    onPress: () => createNote.mutate("quick"),
                  },
                  {
                    label: "New folder",
                    icon: "folder-plus" as const,
                    onPress: () => setAddingFolder(true),
                  },
                ].map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={item.onPress}
                    disabled={createNote.isPending}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      paddingHorizontal: 20,
                      paddingVertical: 15,
                      backgroundColor: pressed ? bgSubtle : "transparent",
                    })}
                  >
                    <Feather name={item.icon} size={18} color="#4263eb" />
                    <Text style={{ fontSize: 15, color: textColor }}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
