import { type ReactNode, useEffect, useRef, useState } from "react";
import { IconMoon, IconSun, IconWifiOff } from "@tabler/icons-react";
import {
  ActionIcon,
  AppShell as MantineAppShell,
  Badge,
  Burger,
  Drawer,
  Group,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMantineColorScheme } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { networkStatusAtom } from "../store/networkStatusAtom.js";
import "../lib/electronAPI.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  asidePanelOpenAtom,
  currentVaultAtom,
  fullscreenPaneAtom,
  viewsPaneOpenAtom,
} from "../store/atoms.js";
import {
  createFolder,
  createNote,
  createVault,
  deleteFolder,
  deleteNote,
  deleteVault,
  foldersKeys,
  getFolders,
  getNotes,
  getPlugins,
  getVaults,
  moveNote,
  notesKeys,
  pluginsKeys,
  reorderNotes,
  updateFolderIcon,
  updateNoteIcon,
  updateNoteKind,
  updateNotePin,
  vaultsKeys,
} from "../lib/api.js";
import { loadAllPlugins } from "../lib/pluginLoader.js";
import { TabBar } from "./TabBar.js";
import { BrowsePane } from "./BrowsePane.js";
import { noteKindRegistry } from "../lib/noteKindRegistry.js";
import { Sidebar } from "./sidebar/Sidebar.js";
import { ServerIndicator } from "./ServerIndicator.js";
import { NoteAsidePanel } from "./aside/NoteAsidePanel.js";
import { CreateVaultModal } from "./modals/CreateVaultModal.js";
import { CreateFolderModal } from "./modals/CreateFolderModal.js";
import { DeleteConfirmModal, type DeleteTarget } from "./modals/DeleteConfirmModal.js";
import { MoveNoteModal } from "./modals/MoveNoteModal.js";
import type { NoteMetadata } from "@nodeira/shared-types";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [navOpen, { toggle: toggleNav }] = useDisclosure(true);
  const [asideOpen] = useAtom(asidePanelOpenAtom);
  const [fullscreenPane, setFullscreenPane] = useAtom(fullscreenPaneAtom);
  const [viewsPaneOpen] = useAtom(viewsPaneOpenAtom);
  const [currentVaultId, setCurrentVaultId] = useAtom(currentVaultAtom);
  const networkStatus = useAtomValue(networkStatusAtom);
  const setNetworkStatus = useSetAtom(networkStatusAtom);
  const [search, setSearch] = useState("");
  const [newFolderOpen, { open: openNewFolder, close: closeNewFolder }] = useDisclosure(false);
  const [newVaultOpen, { open: openNewVault, close: closeNewVault }] = useDisclosure(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<NoteMetadata | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const qc = useQueryClient();

  const { data: vaults = [] } = useQuery({ queryKey: vaultsKeys.all, queryFn: getVaults });
  const { data: installedPlugins = [] } = useQuery({
    queryKey: pluginsKeys.all,
    queryFn: getPlugins,
  });

  useEffect(() => {
    if (!currentVaultId && vaults.length > 0) {
      setCurrentVaultId(vaults[0]!.id);
    }
  }, [vaults, currentVaultId]);

  const pluginsLoaded = useRef(false);
  useEffect(() => {
    if (pluginsLoaded.current || installedPlugins.length === 0) return;
    pluginsLoaded.current = true;
    const sources = installedPlugins.filter((p) => p.enabled).map((p) => p.source);
    (async () => {
      try {
        await loadAllPlugins(sources);
      } catch (err) {
        console.error("[Nodeira] Plugin bootstrap failed:", err);
      }
    })();
  }, [installedPlugins]);

  // Seed TanStack Query cache from SQLite on startup (Electron only) so the notes
  // list renders immediately without waiting for a server round-trip.
  useEffect(() => {
    const api = window.electronAPI?.sqlite;
    if (!api) return;
    void api.getNoteMetadata().then((cached) => {
      qc.setQueryData(notesKeys.all, cached);
      const byVault = new Map<string, typeof cached>();
      for (const note of cached) {
        if (note.vaultId) {
          const list = byVault.get(note.vaultId) ?? [];
          list.push(note);
          byVault.set(note.vaultId, list);
        }
      }
      for (const [vaultId, vaultNotes] of byVault) {
        qc.setQueryData(notesKeys.byVault(vaultId), vaultNotes);
      }
    });
  }, [qc]);

  // Sync browser online/offline events → networkStatusAtom
  useEffect(() => {
    const handleOnline = () => setNetworkStatus("online");
    const handleOffline = () => setNetworkStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setNetworkStatus]);

  // Supplement navigator.onLine with Yjs WebSocket connection status.
  // A successful WS connection is a reliable "definitely online" signal.
  // A WS disconnect only updates status when navigator.onLine also agrees.
  useEffect(() => {
    const handler = (e: Event) => {
      const status = (e as CustomEvent<string>).detail;
      if (status === "connected") {
        setNetworkStatus("online");
      } else if (status === "disconnected" && !navigator.onLine) {
        setNetworkStatus("offline");
      }
    };
    window.addEventListener("yjs:ws-status", handler);
    return () => window.removeEventListener("yjs:ws-status", handler);
  }, [setNetworkStatus]);

  // When coming back online, refresh the notes list from the server
  const prevNetworkStatus = useRef(networkStatus);
  useEffect(() => {
    if (prevNetworkStatus.current === "offline" && networkStatus === "online") {
      void qc.invalidateQueries({ queryKey: notesKeys.all });
    }
    prevNetworkStatus.current = networkStatus;
  }, [networkStatus, qc]);

  // Desktop IPC: new-note, open-search, toggle-sidebar events from native menu / global shortcuts
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const unsubNewNote = api.onNewNote(() => {
      void handleCreateNote("note");
    });
    const unsubToggleSidebar = api.onToggleSidebar(() => {
      toggleNav();
    });

    return () => {
      unsubNewNote();
      unsubToggleSidebar();
    };
  }, []);

  const notesQueryKey = currentVaultId ? notesKeys.byVault(currentVaultId) : notesKeys.all;
  const foldersQueryKey = currentVaultId ? foldersKeys.byVault(currentVaultId) : foldersKeys.all;

  const { data: notes = [] } = useQuery({
    queryKey: notesQueryKey,
    queryFn: () => getNotes(currentVaultId ?? undefined),
  });

  // Keep SQLite warm: upsert fresh server data back into the local cache.
  useEffect(() => {
    const api = window.electronAPI?.sqlite;
    if (!api || notes.length === 0) return;
    void api.upsertNoteMetadata(notes);
  }, [notes]);

  const { data: folders = [] } = useQuery({
    queryKey: foldersQueryKey,
    queryFn: () => getFolders(currentVaultId ?? undefined),
  });

  const createNoteMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: () => notifications.show({ message: "Couldn't create note", color: "red" }),
  });
  const createFolderMutation = useMutation({
    mutationFn: ({ name, vaultId }: { name: string; vaultId?: string }) =>
      createFolder(name, vaultId),
    onSuccess: () => qc.invalidateQueries({ queryKey: foldersQueryKey }),
    onError: () => notifications.show({ message: "Couldn't create folder", color: "red" }),
  });
  const createVaultMutation = useMutation({
    mutationFn: createVault,
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultsKeys.all }),
    onError: () => notifications.show({ message: "Couldn't create vault", color: "red" }),
  });
  const deleteVaultMutation = useMutation({
    mutationFn: deleteVault,
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultsKeys.all }),
    onError: () => notifications.show({ message: "Couldn't delete vault", color: "red" }),
  });
  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: notesQueryKey }),
    onError: () => notifications.show({ message: "Couldn't delete note", color: "red" }),
  });
  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foldersQueryKey });
      qc.invalidateQueries({ queryKey: notesQueryKey });
    },
    onError: () => notifications.show({ message: "Couldn't delete folder", color: "red" }),
  });
  const reorderMutation = useMutation({ mutationFn: reorderNotes });
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => updateNotePin(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesQueryKey }),
  });
  const noteIconMutation = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) => updateNoteIcon(id, icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesQueryKey }),
  });
  const folderIconMutation = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) => updateFolderIcon(id, icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: foldersQueryKey }),
  });
  const moveNoteMutation = useMutation({
    mutationFn: ({
      id,
      vaultId,
      folderId,
    }: {
      id: string;
      vaultId: string | null;
      folderId: string | null;
    }) => moveNote(id, { vaultId, folderId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesKeys.all });
      qc.invalidateQueries({ queryKey: notesQueryKey });
    },
  });
  const kindMutation = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: string | null }) => {
      const def = noteKindRegistry.get(kind);
      return updateNoteKind(id, kind, def?.defaultMeta ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const noteRouteMatch = routerState.location.pathname.match(/^\/notes\/([^/]+)$/);
  const activeNoteId = noteRouteMatch?.[1] ?? null;
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const activeDragNote = notes.find((n) => n.id === activeDragId) ?? null;

  async function handleCreateNote(type: "note" | "quick", folderId?: string) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const note = await createNoteMutation.mutateAsync({
      type,
      ...(currentVaultId ? { vaultId: currentVaultId } : {}),
      ...(folderId ? { folderId } : {}),
      ...(type === "note" ? { title: `note - ${dateStr}` } : {}),
    });
    if (type === "quick") {
      await navigate({ to: "/quick-notes" });
    } else {
      await navigate({ to: "/notes/$noteId", params: { noteId: note.id }, search: { new: true } });
    }
  }

  async function handleCreateFolder(name: string) {
    await createFolderMutation.mutateAsync({
      name,
      ...(currentVaultId ? { vaultId: currentVaultId } : {}),
    });
    closeNewFolder();
  }

  async function handleCreateVault(name: string) {
    const vault = await createVaultMutation.mutateAsync(name);
    setCurrentVaultId(vault.id);
    closeNewVault();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "note") {
      await deleteNoteMutation.mutateAsync(deleteTarget.id);
      if (activeNoteId === deleteTarget.id) await navigate({ to: "/" });
    } else if (deleteTarget.type === "folder") {
      await deleteFolderMutation.mutateAsync(deleteTarget.id);
    } else {
      await deleteVaultMutation.mutateAsync(deleteTarget.id);
      if (currentVaultId === deleteTarget.id) {
        const next = vaults.find((v) => v.id !== deleteTarget.id);
        setCurrentVaultId(next?.id ?? null);
      }
    }
    setDeleteTarget(null);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeNoteItem = notes.find((n) => n.id === String(active.id));
    if (!activeNoteItem) return;

    const overIdStr = String(over.id);
    let updated: NoteMetadata[];

    if (overIdStr.startsWith("folder-drop-")) {
      const targetFolderId = overIdStr.replace("folder-drop-", "");
      if (activeNoteItem.folderId === targetFolderId) return;

      const folderNotes = notes.filter((n) => n.folderId === targetFolderId);
      updated = notes.map((n) =>
        n.id === activeNoteItem.id
          ? { ...n, folderId: targetFolderId, position: folderNotes.length }
          : n,
      );
    } else {
      const overNote = notes.find((n) => n.id === overIdStr);
      if (!overNote) return;

      const targetFolderId = overNote.folderId ?? null;
      const sourceFolderId = activeNoteItem.folderId ?? null;
      const withoutActive = notes.filter((n) => n.id !== activeNoteItem.id);

      const targetContainerNotes = withoutActive.filter(
        (n) => (n.folderId ?? null) === targetFolderId,
      );
      const overIdx = targetContainerNotes.findIndex((n) => n.id === overNote.id);

      let newContainerNotes: NoteMetadata[];
      if (sourceFolderId === targetFolderId) {
        const sourceContainerNotes = notes.filter((n) => (n.folderId ?? null) === sourceFolderId);
        const oldIdx = sourceContainerNotes.findIndex((n) => n.id === activeNoteItem.id);
        const overIdxInSource = sourceContainerNotes.findIndex((n) => n.id === overNote.id);
        newContainerNotes = arrayMove(sourceContainerNotes, oldIdx, overIdxInSource).map(
          (n, i) => ({ ...n, position: i }),
        );
      } else {
        newContainerNotes = [
          ...targetContainerNotes.slice(0, overIdx),
          { ...activeNoteItem, folderId: overNote.folderId ?? null },
          ...targetContainerNotes.slice(overIdx),
        ].map((n, i) => ({ ...n, position: i }));
      }

      const sourceContainerReordered =
        sourceFolderId !== targetFolderId
          ? withoutActive
              .filter((n) => (n.folderId ?? null) === sourceFolderId)
              .map((n, i) => ({ ...n, position: i }))
          : [];

      const unaffected = withoutActive.filter(
        (n) => (n.folderId ?? null) !== targetFolderId && (n.folderId ?? null) !== sourceFolderId,
      );

      updated = [...unaffected, ...newContainerNotes, ...sourceContainerReordered];
    }

    qc.setQueryData(notesKeys.all, updated);
    reorderMutation.mutate(
      updated.map((n) => ({ id: n.id, position: n.position, folderId: n.folderId ?? null })),
      { onError: () => qc.invalidateQueries({ queryKey: notesKeys.all }) },
    );
  }

  return (
    <>
      <MantineAppShell
        header={{ height: 48 }}
        navbar={{
          width: 240,
          breakpoint: "sm",
          collapsed: { mobile: !navOpen, desktop: !navOpen },
        }}
        aside={{
          width: 240,
          breakpoint: "md",
          collapsed: { desktop: !asideOpen, mobile: true },
        }}
        padding={0}
      >
        <MantineAppShell.Header>
          <Group h="100%" px="sm" justify="space-between">
            <Group gap="sm">
              <Burger opened={navOpen} onClick={toggleNav} size="sm" />
              <img src="/logo.svg" alt="Nodeira logo" width={24} height={24} />
              <Text fw={700} size="lg">
                Nodeira
              </Text>
            </Group>
            <Group gap="xs">
              <ServerIndicator />
              {networkStatus === "offline" && (
                <Badge
                  color="orange"
                  variant="light"
                  size="sm"
                  leftSection={<IconWifiOff size={11} />}
                >
                  Offline
                </Badge>
              )}
              <ActionIcon
                variant="subtle"
                onClick={toggleColorScheme}
                title="Toggle dark/light mode"
              >
                {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Group>
          </Group>
        </MantineAppShell.Header>

        <MantineAppShell.Navbar p="xs">
          <Sidebar
            vaults={vaults}
            notes={notes}
            folders={folders}
            search={search}
            onSearchChange={setSearch}
            sensors={sensors}
            activeDragNote={activeDragNote}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onCreateNote={handleCreateNote}
            onOpenNewFolder={openNewFolder}
            onOpenNewVault={openNewVault}
            onDeleteNote={(id, name) => setDeleteTarget({ type: "note", id, name })}
            onDeleteFolder={(id, name) => setDeleteTarget({ type: "folder", id, name })}
            onDeleteVault={(id, name) => setDeleteTarget({ type: "vault", id, name })}
            onTogglePin={(id, pinned) => pinMutation.mutate({ id, pinned })}
            onNoteIconChange={(id, icon) => noteIconMutation.mutate({ id, icon })}
            onFolderIconChange={(id, icon) => folderIconMutation.mutate({ id, icon })}
            onKindChange={(id, kind) => kindMutation.mutate({ id, kind })}
            onMoveNote={(note) => setMoveTarget(note)}
          />
        </MantineAppShell.Navbar>

        <MantineAppShell.Aside>
          <NoteAsidePanel
            note={activeNote}
            folders={folders}
            onKindChange={(id, kind) => kindMutation.mutate({ id, kind })}
            onFullscreen={() => setFullscreenPane(fullscreenPane === "right" ? null : "right")}
            isFullscreen={fullscreenPane === "right"}
          />
        </MantineAppShell.Aside>

        <MantineAppShell.Main
          style={{ display: "flex", flexDirection: "row", height: "100vh", overflow: "hidden" }}
        >
          {viewsPaneOpen && <BrowsePane />}
          <div
            style={
              fullscreenPane === "editor"
                ? {
                    position: "fixed",
                    inset: 0,
                    zIndex: 300,
                    background: "var(--mantine-color-body)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }
                : { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
            }
          >
            <TabBar />
            <div style={{ flex: 1, overflow: "auto", padding: "var(--mantine-spacing-md)" }}>
              {children}
            </div>
          </div>
        </MantineAppShell.Main>
      </MantineAppShell>

      {/* Right aside fullscreen overlay */}
      <Drawer
        opened={fullscreenPane === "right"}
        onClose={() => setFullscreenPane(null)}
        position="right"
        size="100%"
        withCloseButton={false}
        styles={{
          body: { padding: 0, height: "100%" },
          content: { display: "flex", flexDirection: "column" },
        }}
      >
        <NoteAsidePanel
          note={activeNote}
          folders={folders}
          onKindChange={(id, kind) => kindMutation.mutate({ id, kind })}
          onFullscreen={() => setFullscreenPane(null)}
          isFullscreen={true}
        />
      </Drawer>

      <CreateVaultModal
        opened={newVaultOpen}
        onClose={closeNewVault}
        onCreate={handleCreateVault}
      />
      <CreateFolderModal
        opened={newFolderOpen}
        onClose={closeNewFolder}
        onCreate={handleCreateFolder}
      />
      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <MoveNoteModal
        note={moveTarget}
        onClose={() => setMoveTarget(null)}
        onMove={(noteId, vaultId, folderId) =>
          moveNoteMutation.mutate({ id: noteId, vaultId, folderId })
        }
      />
    </>
  );
}
