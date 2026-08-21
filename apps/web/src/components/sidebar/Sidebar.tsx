import {
  IconBell,
  IconBolt,
  IconChevronDown,
  IconFile,
  IconLayout,
  IconLayoutColumns,
  IconLayoutGridAdd,
  IconLogout,
  IconNetwork,
  IconPlus,
  IconSettings,
  IconTag,
  IconTrash,
} from "@tabler/icons-react";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SensorDescriptor, SensorOptions } from "@dnd-kit/core";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  authUserAtom,
  currentVaultAtom,
  sidebarItemFilterAtom,
  viewsPaneOpenAtom,
} from "../../store/atoms.js";
import { destroyAllYjsContexts } from "../../providers/YjsProvider.js";
import { authStorage } from "../../lib/authStorage.js";
import { clearAttachmentTicket } from "../../lib/attachments.js";
import { pluginRegistry, pluginRegistryVersionAtom } from "../../lib/pluginRegistry.js";
import { DynamicIcon } from "../DynamicIcon.js";
import { SortableNoteItem } from "./SortableNoteItem.js";
import { CanvasNavItem } from "./CanvasNavItem.js";
import { FolderNavItem } from "./FolderNavItem.js";
import type { Canvas, Folder, NoteMetadata, Vault } from "@nodeira/shared-types";

interface SidebarProps {
  vaults: Vault[];
  notes: NoteMetadata[];
  canvases: Canvas[];
  folders: Folder[];
  search: string;
  onSearchChange: (val: string) => void;
  sensors: SensorDescriptor<SensorOptions>[];
  activeDragNote: NoteMetadata | null;
  activeDragCanvas: Canvas | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onCreateNote: (type: "note" | "quick", folderId?: string) => void;
  onCreateCanvas: (folderId?: string) => void;
  onOpenNewFolder: (parentId?: string) => void;
  onOpenNewVault: () => void;
  onDeleteNote: (id: string, name: string) => void;
  onDeleteCanvas: (id: string, name: string) => void;
  onDeleteFolder: (id: string, name: string) => void;
  onDeleteVault: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleCanvasPin: (id: string, pinned: boolean) => void;
  onNoteIconChange: (id: string, icon: string | null) => void;
  onCanvasIconChange: (id: string, icon: string | null) => void;
  onFolderIconChange: (id: string, icon: string | null) => void;
  onKindChange: (id: string, kind: string | null) => void;
  onMoveNote: (note: NoteMetadata) => void;
  onMoveCanvas: (canvas: Canvas) => void;
}

export function Sidebar({
  vaults,
  notes,
  canvases,
  folders,
  search,
  onSearchChange,
  sensors,
  activeDragNote,
  activeDragCanvas,
  onDragStart,
  onDragEnd,
  onCreateNote,
  onCreateCanvas,
  onOpenNewFolder,
  onOpenNewVault,
  onDeleteNote,
  onDeleteCanvas,
  onDeleteFolder,
  onDeleteVault,
  onTogglePin,
  onToggleCanvasPin,
  onNoteIconChange,
  onCanvasIconChange,
  onFolderIconChange,
  onKindChange,
  onMoveNote,
  onMoveCanvas,
}: SidebarProps) {
  const [currentVaultId, setCurrentVaultId] = useAtom(currentVaultAtom);
  const [viewsPaneOpen, setViewsPaneOpen] = useAtom(viewsPaneOpenAtom);
  const [itemFilter, setItemFilter] = useAtom(sidebarItemFilterAtom);
  const routerState = useRouterState();
  useAtomValue(pluginRegistryVersionAtom);
  const pluginPages = pluginRegistry.getPages();
  const authUser = useAtomValue(authUserAtom);
  const setAuthUser = useSetAtom(authUserAtom);
  const navigate = useNavigate();

  function handleLogout() {
    // Hocuspocus providers capture the auth token once at construction and never refresh
    // it, so without this every cached socket stays open authenticated as the user who
    // just logged out, until a full page reload.
    destroyAllYjsContexts();
    // Same reasoning as the sockets: the attachment ticket outlives the session token by up
    // to an hour, so it has to be dropped explicitly rather than left for the next user.
    clearAttachmentTicket();
    authStorage.clear();
    setAuthUser(null);
    void navigate({ to: "/login" });
  }

  const currentVault = vaults.find((v) => v.id === currentVaultId) ?? null;
  // The Notes/Canvases/All toggle hides one type from the whole tree below — pinned,
  // folders and unfoldered sections all read from these instead of the raw props, so
  // there is exactly one place that decides what's visible.
  const visibleNotes = itemFilter === "canvases" ? [] : notes;
  const visibleCanvases = itemFilter === "notes" ? [] : canvases;

  const regularNotes = visibleNotes.filter((n) => n.type === "note");
  const pinnedNotes = regularNotes.filter((n) => n.pinned);
  const pinnedCanvases = visibleCanvases.filter((c) => c.pinned);
  const quickNoteCount = notes.filter((n) => n.type === "quick").length;
  const unfolderedNotes = regularNotes
    .filter(
      (n) =>
        !n.folderId &&
        !n.pinned &&
        (!search || n.title.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  const unfolderedCanvases = visibleCanvases
    .filter(
      (c) =>
        !c.folderId &&
        !c.pinned &&
        (!search || c.title.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());

  const isOnQuickNotes = routerState.location.pathname === "/quick-notes";
  const isOnGraph = routerState.location.pathname === "/graph";
  const isOnTags = routerState.location.pathname === "/tags";
  const isOnReminders = routerState.location.pathname === "/reminders";
  const isOnSettings = routerState.location.pathname === "/settings";

  return (
    <Stack gap="xs" h="100%">
      {/* Vault switcher + view controls */}
      <Group gap={4} wrap="nowrap">
        <Menu position="bottom-start" withArrow>
          <Menu.Target>
            <button
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 6px",
                borderRadius: 6,
                minWidth: 0,
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--mantine-color-default-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "none";
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  background: "var(--mantine-primary-color-filled)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(currentVault?.name?.[0] ?? "V").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <Text
                  size="xs"
                  fw={600}
                  style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {currentVault?.name ?? "Loading…"}
                </Text>
                <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                  {notes.length} notes
                </Text>
              </div>
              <IconChevronDown size={12} color="var(--mantine-color-dimmed)" />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Vaults</Menu.Label>
            {vaults.map((v) => (
              <Menu.Item
                key={v.id}
                onClick={() => setCurrentVaultId(v.id)}
                style={{ fontWeight: v.id === currentVaultId ? 600 : undefined }}
                rightSection={
                  <ActionIcon
                    component="div"
                    role="button"
                    tabIndex={0}
                    size="xs"
                    variant="subtle"
                    color="red"
                    title="Delete vault"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVault(v.id, v.name);
                    }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                }
              >
                {v.name}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<IconPlus size={13} />} onClick={onOpenNewVault}>
              New vault
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <ActionIcon
          variant={viewsPaneOpen ? "light" : "subtle"}
          size="sm"
          onClick={() => setViewsPaneOpen((o) => !o)}
          title="Toggle browse pane"
        >
          <IconLayoutColumns size={15} />
        </ActionIcon>
      </Group>

      <TextInput
        placeholder="Search…"
        size="xs"
        value={search}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
      />

      <Menu position="bottom-start" withArrow>
        <Menu.Target>
          <Button size="xs" variant="light" fullWidth>
            + New ▾
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => onCreateNote("note")}>New Note</Menu.Item>
          <Menu.Item onClick={() => onCreateNote("quick")}>New Quick Note</Menu.Item>
          <Menu.Item leftSection={<IconLayoutGridAdd size={14} />} onClick={() => onCreateCanvas()}>
            New Canvas
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item onClick={() => onOpenNewFolder()}>New Folder</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <SegmentedControl
        size="xs"
        fullWidth
        value={itemFilter}
        onChange={(val) => setItemFilter(val as "all" | "notes" | "canvases")}
        data={[
          { label: "All", value: "all" },
          { label: "Notes", value: "notes" },
          { label: "Canvases", value: "canvases" },
        ]}
      />

      <Divider />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <ScrollArea flex={1} offsetScrollbars>
          <Stack gap={2}>
            {/* Pinned */}
            {(pinnedNotes.length > 0 || pinnedCanvases.length > 0) && (
              <>
                <Text
                  size="xs"
                  fw={600}
                  tt="uppercase"
                  c="dimmed"
                  px={8}
                  pt={4}
                  pb={2}
                  style={{ letterSpacing: "0.08em" }}
                >
                  Pinned
                </Text>
                <SortableContext
                  items={pinnedNotes.map((n) => n.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {pinnedNotes.map((note) => (
                    <SortableNoteItem
                      key={note.id}
                      note={note}
                      onDelete={onDeleteNote}
                      onTogglePin={onTogglePin}
                      onIconChange={onNoteIconChange}
                      onKindChange={onKindChange}
                      onMove={onMoveNote}
                    />
                  ))}
                </SortableContext>
                {pinnedCanvases.map((canvas) => (
                  <CanvasNavItem
                    key={canvas.id}
                    canvas={canvas}
                    onDelete={onDeleteCanvas}
                    onTogglePin={onToggleCanvasPin}
                    onIconChange={onCanvasIconChange}
                    onMove={onMoveCanvas}
                  />
                ))}
                <Divider my={4} />
              </>
            )}

            {/* Quick Notes */}
            <Link to="/quick-notes" style={{ textDecoration: "none" }}>
              <NavLink
                component="div"
                label={
                  <Group gap={6} justify="space-between">
                    <Text size="sm">Quick Notes</Text>
                    {quickNoteCount > 0 && (
                      <Text size="xs" c="dimmed">
                        {quickNoteCount}
                      </Text>
                    )}
                  </Group>
                }
                leftSection={<IconBolt size={14} />}
                active={isOnQuickNotes}
              />
            </Link>

            {/* Graph view */}
            <Link to="/graph" style={{ textDecoration: "none" }}>
              <NavLink
                component="div"
                label={<Text size="sm">Graph</Text>}
                leftSection={<IconNetwork size={14} />}
                active={isOnGraph}
              />
            </Link>

            {/* Tags view */}
            <Link to="/tags" style={{ textDecoration: "none" }}>
              <NavLink
                component="div"
                label={<Text size="sm">Tags</Text>}
                leftSection={<IconTag size={14} />}
                active={isOnTags}
              />
            </Link>

            {/* Reminders */}
            <Link to="/reminders" style={{ textDecoration: "none" }}>
              <NavLink
                component="div"
                label={<Text size="sm">Reminders</Text>}
                leftSection={<IconBell size={14} />}
                active={isOnReminders}
              />
            </Link>

            {/* Plugin pages */}
            {pluginPages.map((page) => {
              const isOnPage = routerState.location.pathname === `/plugins/${page.pluginId}`;
              return (
                <Link
                  key={page.pluginId}
                  to="/plugins/$pluginId"
                  params={{ pluginId: page.pluginId }}
                  style={{ textDecoration: "none" }}
                >
                  <NavLink
                    component="div"
                    label={page.label}
                    leftSection={<DynamicIcon name={page.icon} size={14} />}
                    active={isOnPage}
                  />
                </Link>
              );
            })}

            <Divider my={4} />

            {/* Folders */}
            {folders.length > 0 && (
              <Text
                size="xs"
                fw={600}
                tt="uppercase"
                c="dimmed"
                px={8}
                pb={2}
                style={{ letterSpacing: "0.08em" }}
              >
                Folders
              </Text>
            )}

            {folders
              .filter((folder) => !folder.parentId)
              .map((folder) => (
                <FolderNavItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  notes={regularNotes}
                  canvases={visibleCanvases}
                  search={search}
                  onCreateNote={(folderId) => onCreateNote("note", folderId)}
                  onCreateCanvas={onCreateCanvas}
                  onCreateFolder={onOpenNewFolder}
                  onDelete={onDeleteFolder}
                  onDeleteNote={onDeleteNote}
                  onDeleteCanvas={onDeleteCanvas}
                  onTogglePin={onTogglePin}
                  onToggleCanvasPin={onToggleCanvasPin}
                  onNoteIconChange={onNoteIconChange}
                  onCanvasIconChange={onCanvasIconChange}
                  onIconChange={onFolderIconChange}
                  onNoteKindChange={onKindChange}
                  onMoveNote={onMoveNote}
                  onMoveCanvas={onMoveCanvas}
                />
              ))}

            {/* Unfoldered notes and canvases */}
            <SortableContext
              items={unfolderedNotes.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              {unfolderedNotes.map((note) => (
                <SortableNoteItem
                  key={note.id}
                  note={note}
                  onDelete={onDeleteNote}
                  onTogglePin={onTogglePin}
                  onIconChange={onNoteIconChange}
                  onKindChange={onKindChange}
                  onMove={onMoveNote}
                />
              ))}
            </SortableContext>
            {unfolderedCanvases.map((canvas) => (
              <CanvasNavItem
                key={canvas.id}
                canvas={canvas}
                onDelete={onDeleteCanvas}
                onTogglePin={onToggleCanvasPin}
                onIconChange={onCanvasIconChange}
                onMove={onMoveCanvas}
              />
            ))}
          </Stack>
        </ScrollArea>

        <DragOverlay>
          {activeDragNote || activeDragCanvas ? (
            <Box
              style={{
                padding: "6px 10px",
                background: "var(--mantine-color-body)",
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 4,
                boxShadow: "var(--mantine-shadow-sm)",
                cursor: "grabbing",
              }}
            >
              <Group gap={6}>
                {activeDragNote ? (
                  <>
                    <IconFile size={14} />
                    <Text size="sm">{activeDragNote.title || "Untitled"}</Text>
                  </>
                ) : (
                  <>
                    <IconLayout size={14} />
                    <Text size="sm">{activeDragCanvas?.title || "Untitled Canvas"}</Text>
                  </>
                )}
              </Group>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Bottom: user + settings */}
      <Box>
        <Divider mb="xs" />
        <Stack gap={0}>
          <Link to="/settings" style={{ textDecoration: "none" }}>
            <NavLink
              component="div"
              label={authUser?.name ?? authUser?.email ?? "User"}
              leftSection={
                <Avatar size="sm" color="blue" radius="xl">
                  {(authUser?.name ?? authUser?.email ?? "U")[0]?.toUpperCase()}
                </Avatar>
              }
            />
          </Link>
          <Box px="xs" pb="xs">
            <Button
              fullWidth
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconLogout size={13} />}
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </Box>
          <Link to="/settings" style={{ textDecoration: "none" }}>
            <NavLink
              component="div"
              label="Settings"
              leftSection={<IconSettings size={14} />}
              active={isOnSettings}
            />
          </Link>
        </Stack>
      </Box>
    </Stack>
  );
}
