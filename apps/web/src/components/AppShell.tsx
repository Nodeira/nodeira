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
import { UpdateAvailableModal } from "./modals/UpdateAvailableModal.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  asidePanelOpenAtom,
  asideWidthAtom,
  currentVaultAtom,
  fullscreenPaneAtom,
  navbarWidthAtom,
  viewsPaneOpenAtom,
} from "../store/atoms.js";
import {
  canvasKeys,
  createCanvas,
  createFolder,
  createNote,
  createVault,
  deleteCanvas,
  deleteFolder,
  deleteVault,
  foldersKeys,
  getCanvases,
  getFolders,
  getNotes,
  getPlugins,
  getVaults,
  moveNote,
  notesKeys,
  pluginsKeys,
  reorderNotes,
  updateCanvas,
  updateFolderIcon,
  updateNoteIcon,
  updateNoteKind,
  updateNotePin,
  vaultsKeys,
} from "../lib/api.js";
import { loadAllPlugins } from "../lib/pluginLoader.js";
import { useDeleteNote } from "../lib/useDeleteNote.js";
import { useActiveVaultId } from "../lib/useActiveVaultId.js";
import { noteIdFromPath } from "../lib/routeMatch.js";
import { useReminderSocket } from "../lib/useReminderSocket.js";
import { TabBar } from "./TabBar.js";
import { BrowsePane } from "./BrowsePane.js";
import { noteKindRegistry } from "../lib/noteKindRegistry.js";
import { Sidebar } from "./sidebar/Sidebar.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { ServerIndicator } from "./ServerIndicator.js";
import { NoteAsidePanel } from "./aside/NoteAsidePanel.js";
import { CreateNamedItemModal } from "./modals/CreateNamedItemModal.js";
import { DeleteConfirmModal, type DeleteTarget } from "./modals/DeleteConfirmModal.js";
import { MoveItemModal, type MoveItemTarget } from "./modals/MoveItemModal.js";
import type { NoteMetadata } from "@nodeira/shared-types";

/** Discriminates which mutation a pending "move to…" action should use on confirm. */
interface MoveTarget {
  kind: "note" | "canvas";
  item: MoveItemTarget;
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [navOpen, { toggle: toggleNav }] = useDisclosure(true);
  const [asideOpen] = useAtom(asidePanelOpenAtom);
  const [fullscreenPane, setFullscreenPane] = useAtom(fullscreenPaneAtom);
  const [viewsPaneOpen] = useAtom(viewsPaneOpenAtom);
  const [navbarWidth, setNavbarWidth] = useAtom(navbarWidthAtom);
  const [asideWidth, setAsideWidth] = useAtom(asideWidthAtom);
  const [currentVaultId, setCurrentVaultId] = useAtom(currentVaultAtom);
  const networkStatus = useAtomValue(networkStatusAtom);
  const setNetworkStatus = useSetAtom(networkStatusAtom);
  const [search, setSearch] = useState("");
  const [newFolderOpen, { open: openNewFolder, close: closeNewFolder }] = useDisclosure(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newVaultOpen, { open: openNewVault, close: closeNewVault }] = useDisclosure(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const qc = useQueryClient();
  const activeVaultId = useActiveVaultId();

  // Subscribe to fired reminders (toast) and register this client as a device.
  useReminderSocket();

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
    void api.getNoteMetadata().then((raw) => {
      // Dates cross the IPC boundary as ISO strings (JSON can't carry Date
      // objects). The rest of the app — sorting, formatting — assumes real
      // Date instances, so rehydrate them before seeding the query cache.
      const cached = raw.map((n) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
      }));
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

  // This effect subscribes once on mount, so it must read the latest handlers via
  // refs — a plain closure would capture stale state (e.g. currentVaultId before
  // the vault loads), creating orphaned notes the vault-filtered views never show.
  const handleCreateNoteRef = useRef(handleCreateNote);
  handleCreateNoteRef.current = handleCreateNote;
  const toggleNavRef = useRef(toggleNav);
  toggleNavRef.current = toggleNav;

  // Desktop IPC: new-note, new-quick-note, toggle-sidebar events from native menu / global shortcuts
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const unsubNewNote = api.onNewNote(() => {
      void handleCreateNoteRef.current("note");
    });
    const unsubNewQuickNote = api.onNewQuickNote(() => {
      void handleCreateNoteRef.current("quick");
    });
    const unsubToggleSidebar = api.onToggleSidebar(() => {
      toggleNavRef.current();
    });

    return () => {
      unsubNewNote();
      unsubNewQuickNote();
      unsubToggleSidebar();
    };
  }, []);

  // Read key for THIS component. Never invalidate with it: TanStack matches query keys by
  // prefix, so invalidating notesKeys.all (["notes"]) also refreshes every byVault entry,
  // but invalidating byVault (["notes","vault",id]) leaves ["notes"] stale — and TabBar,
  // BrowsePane, GraphView and NoteEditor all read ["notes"]. Mutations below use
  // notesKeys.all for that reason.
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

  const canvasesQueryKey = currentVaultId ? canvasKeys.byVault(currentVaultId) : canvasKeys.all;
  const { data: canvases = [] } = useQuery({
    queryKey: canvasesQueryKey,
    queryFn: () => getCanvases(currentVaultId ? { vaultId: currentVaultId } : {}),
  });

  const createNoteMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: () => notifications.show({ message: "Couldn't create note", color: "red" }),
  });
  const createFolderMutation = useMutation({
    mutationFn: ({
      name,
      vaultId,
      parentId,
    }: {
      name: string;
      vaultId: string;
      parentId?: string;
    }) => createFolder(name, vaultId, parentId),
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
  const deleteNoteMutation = useDeleteNote();
  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foldersQueryKey });
      qc.invalidateQueries({ queryKey: notesKeys.all });
    },
    onError: () => notifications.show({ message: "Couldn't delete folder", color: "red" }),
  });
  const reorderMutation = useMutation({ mutationFn: reorderNotes });
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => updateNotePin(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });
  const noteIconMutation = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) => updateNoteIcon(id, icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });
  const createCanvasMutation = useMutation({
    mutationFn: createCanvas,
    onSuccess: () => qc.invalidateQueries({ queryKey: canvasKeys.all }),
    onError: () => notifications.show({ message: "Couldn't create canvas", color: "red" }),
  });
  const deleteCanvasMutation = useMutation({
    mutationFn: deleteCanvas,
    onSuccess: () => qc.invalidateQueries({ queryKey: canvasKeys.all }),
    onError: () => notifications.show({ message: "Couldn't delete canvas", color: "red" }),
  });
  const canvasPinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => updateCanvas(id, { pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: canvasKeys.all }),
  });
  const canvasIconMutation = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) => updateCanvas(id, { icon }),
    onSuccess: () => qc.invalidateQueries({ queryKey: canvasKeys.all }),
  });
  const moveCanvasMutation = useMutation({
    mutationFn: ({
      id,
      vaultId,
      folderId,
    }: {
      id: string;
      vaultId: string | null;
      folderId: string | null;
      // A canvas always belongs to a vault (unlike folderId, which can go back to null),
      // so "No vault" in the move modal is a no-op for vaultId rather than a clearing write
      // that would fail the server's not-null column.
    }) => updateCanvas(id, { ...(vaultId ? { vaultId } : {}), folderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: canvasKeys.all }),
  });
  const kindMutation = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: string | null }) => {
      const def = noteKindRegistry.get(kind);
      return updateNoteKind(id, kind, def?.defaultMeta ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });
  // Distinct from kindMutation: changing a task's status must PRESERVE the rest of
  // kindMeta, whereas changing the kind resets it to that kind's defaults.
  const kindMetaMutation = useMutation({
    mutationFn: ({
      id,
      kind,
      kindMeta,
    }: {
      id: string;
      kind: string | null;
      kindMeta: Record<string, unknown> | null;
    }) => updateNoteKind(id, kind, kindMeta),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: () => notifications.show({ message: "Couldn't update status", color: "red" }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeNoteId = noteIdFromPath(routerState.location.pathname);
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const activeDragNote = notes.find((n) => n.id === activeDragId) ?? null;
  const activeDragCanvas =
    canvases.find((c) => activeDragId != null && activeDragId === `canvas-${c.id}`) ?? null;

  function handleStatusChange(id: string, status: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    kindMetaMutation.mutate({
      id,
      kind: "task",
      kindMeta: { ...(note.kindMeta ?? {}), status },
    });
  }

  async function handleCreateNote(type: "note" | "quick", folderId?: string) {
    // A note with no vault is rejected by the server: access is decided by vault
    // membership, so there is nothing to authorize against.
    if (!activeVaultId) {
      notifications.show({
        message: "No vault available yet — try again in a moment",
        color: "red",
      });
      return;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const note = await createNoteMutation.mutateAsync({
      type,
      vaultId: activeVaultId,
      ...(folderId ? { folderId } : {}),
      ...(type === "note" ? { title: `note - ${dateStr}` } : {}),
    });
    if (type === "quick") {
      await navigate({ to: "/quick-notes" });
    } else {
      await navigate({ to: "/notes/$noteId", params: { noteId: note.id }, search: { new: true } });
    }
  }

  async function handleCreateCanvas(folderId?: string) {
    if (!activeVaultId) {
      notifications.show({
        message: "No vault available yet — try again in a moment",
        color: "red",
      });
      return;
    }
    const canvas = await createCanvasMutation.mutateAsync({
      vaultId: activeVaultId,
      ...(folderId ? { folderId } : {}),
    });
    await navigate({ to: "/canvas/$canvasId", params: { canvasId: canvas.id } });
  }

  function handleOpenNewFolder(parentId?: string) {
    setNewFolderParentId(parentId ?? null);
    openNewFolder();
  }

  async function handleCreateFolder(name: string) {
    if (!activeVaultId) {
      notifications.show({
        message: "No vault available yet — try again in a moment",
        color: "red",
      });
      return;
    }
    await createFolderMutation.mutateAsync({
      name,
      vaultId: activeVaultId,
      ...(newFolderParentId ? { parentId: newFolderParentId } : {}),
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
    } else if (deleteTarget.type === "canvas") {
      await deleteCanvasMutation.mutateAsync(deleteTarget.id);
      if (routerState.location.pathname === `/canvas/${deleteTarget.id}`) {
        await navigate({ to: "/" });
      }
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

    const activeIdStr = String(active.id);

    // Canvases are draggable but not sortable (see CanvasNavItem) — the only drop that
    // does anything is onto a folder header. Their id is prefixed so it can't collide
    // with a note id in the lookup below.
    if (activeIdStr.startsWith("canvas-")) {
      const canvasId = activeIdStr.replace("canvas-", "");
      const canvas = canvases.find((c) => c.id === canvasId);
      if (!canvas) return;
      const overIdStr = String(over.id);
      if (!overIdStr.startsWith("folder-drop-")) return;
      const targetFolderId = overIdStr.replace("folder-drop-", "");
      if ((canvas.folderId ?? null) === targetFolderId) return;
      moveCanvasMutation.mutate({ id: canvas.id, vaultId: null, folderId: targetFolderId });
      return;
    }

    const activeNoteItem = notes.find((n) => n.id === activeIdStr);
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

    // setQueryData writes to one exact key (no prefix matching), so the vault-scoped entry
    // this component actually renders from has to be written separately — otherwise the
    // sidebar snaps back to the old order until the next refetch.
    qc.setQueryData(notesKeys.all, updated);
    if (currentVaultId) qc.setQueryData(notesKeys.byVault(currentVaultId), updated);
    reorderMutation.mutate(
      updated.map((n) => ({ id: n.id, position: n.position, folderId: n.folderId ?? null })),
      { onError: () => qc.invalidateQueries({ queryKey: notesKeys.all }) },
    );
  }

  return (
    <>
      <UpdateAvailableModal />
      <MantineAppShell
        header={{ height: 48 }}
        navbar={{
          width: navbarWidth,
          breakpoint: "sm",
          collapsed: { mobile: !navOpen, desktop: !navOpen },
        }}
        aside={{
          width: asideWidth,
          breakpoint: "md",
          collapsed: { desktop: !asideOpen, mobile: true },
        }}
        padding={0}
      >
        <MantineAppShell.Header>
          <Group h="100%" px="sm" justify="space-between">
            <Group gap="sm">
              <Burger opened={navOpen} onClick={toggleNav} size="sm" />
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt="Nodeira logo"
                width={24}
                height={24}
              />
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
            canvases={canvases}
            folders={folders}
            search={search}
            onSearchChange={setSearch}
            sensors={sensors}
            activeDragNote={activeDragNote}
            activeDragCanvas={activeDragCanvas}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onCreateNote={handleCreateNote}
            onCreateCanvas={(folderId) => void handleCreateCanvas(folderId)}
            onOpenNewFolder={handleOpenNewFolder}
            onOpenNewVault={openNewVault}
            onDeleteNote={(id, name) => setDeleteTarget({ type: "note", id, name })}
            onDeleteCanvas={(id, name) => setDeleteTarget({ type: "canvas", id, name })}
            onDeleteFolder={(id, name) => setDeleteTarget({ type: "folder", id, name })}
            onDeleteVault={(id, name) => setDeleteTarget({ type: "vault", id, name })}
            onTogglePin={(id, pinned) => pinMutation.mutate({ id, pinned })}
            onToggleCanvasPin={(id, pinned) => canvasPinMutation.mutate({ id, pinned })}
            onNoteIconChange={(id, icon) => noteIconMutation.mutate({ id, icon })}
            onCanvasIconChange={(id, icon) => canvasIconMutation.mutate({ id, icon })}
            onFolderIconChange={(id, icon) => folderIconMutation.mutate({ id, icon })}
            onKindChange={(id, kind) => kindMutation.mutate({ id, kind })}
            onMoveNote={(note) =>
              setMoveTarget({
                kind: "note",
                item: {
                  id: note.id,
                  vaultId: note.vaultId,
                  folderId: note.folderId ?? null,
                  label: note.title || "Untitled",
                },
              })
            }
            onMoveCanvas={(canvas) =>
              setMoveTarget({
                kind: "canvas",
                item: {
                  id: canvas.id,
                  vaultId: canvas.vaultId,
                  folderId: canvas.folderId,
                  label: canvas.title || "Untitled Canvas",
                },
              })
            }
          />
        </MantineAppShell.Navbar>

        <MantineAppShell.Aside>
          <NoteAsidePanel
            note={activeNote}
            folders={folders}
            onKindChange={(id, kind) => kindMutation.mutate({ id, kind })}
            onStatusChange={handleStatusChange}
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

      {/* Drag handles to resize the side panels (hidden when their panel is collapsed) */}
      {navOpen && <ResizeHandle panel="navbar" width={navbarWidth} setWidth={setNavbarWidth} />}
      {asideOpen && fullscreenPane !== "right" && (
        <ResizeHandle panel="aside" width={asideWidth} setWidth={setAsideWidth} />
      )}

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
          onStatusChange={handleStatusChange}
          onFullscreen={() => setFullscreenPane(null)}
          isFullscreen={true}
        />
      </Drawer>

      <CreateNamedItemModal
        title="New Vault"
        label="Vault name"
        placeholder="Work"
        opened={newVaultOpen}
        onClose={closeNewVault}
        onCreate={handleCreateVault}
      />
      <CreateNamedItemModal
        title="New Folder"
        label="Folder name"
        placeholder="My Notes"
        opened={newFolderOpen}
        onClose={closeNewFolder}
        onCreate={handleCreateFolder}
      />
      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <MoveItemModal
        target={moveTarget?.item ?? null}
        itemLabel={moveTarget ? (moveTarget.kind === "canvas" ? "canvas" : "note") : "item"}
        onClose={() => setMoveTarget(null)}
        onMove={(id, vaultId, folderId) =>
          moveTarget?.kind === "canvas"
            ? moveCanvasMutation.mutate({ id, vaultId, folderId })
            : moveNoteMutation.mutate({ id, vaultId, folderId })
        }
      />
    </>
  );
}
