import {
  IconBell,
  IconBolt,
  IconChevronDown,
  IconFile,
  IconLayout,
  IconLayoutColumns,
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
import { authUserAtom, currentVaultAtom, viewsPaneOpenAtom } from "../../store/atoms.js";
import { authStorage } from "../../lib/authStorage.js";
import { pluginRegistry, pluginRegistryVersionAtom } from "../../lib/pluginRegistry.js";
import { DynamicIcon } from "../DynamicIcon.js";
import { SortableNoteItem } from "./SortableNoteItem.js";
import { FolderNavItem } from "./FolderNavItem.js";
import type { Folder, NoteMetadata, Vault } from "@nodeira/shared-types";
import { useQuery } from "@tanstack/react-query";
import { canvasKeys, getCanvases } from "../../lib/api.js";

interface SidebarProps {
  vaults: Vault[];
  notes: NoteMetadata[];
  folders: Folder[];
  search: string;
  onSearchChange: (val: string) => void;
  sensors: SensorDescriptor<SensorOptions>[];
  activeDragNote: NoteMetadata | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onCreateNote: (type: "note" | "quick", folderId?: string) => void;
  onOpenNewFolder: (parentId?: string) => void;
  onOpenNewVault: () => void;
  onDeleteNote: (id: string, name: string) => void;
  onDeleteFolder: (id: string, name: string) => void;
  onDeleteVault: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNoteIconChange: (id: string, icon: string | null) => void;
  onFolderIconChange: (id: string, icon: string | null) => void;
  onKindChange: (id: string, kind: string | null) => void;
  onMoveNote: (note: NoteMetadata) => void;
}

export function Sidebar({
  vaults,
  notes,
  folders,
  search,
  onSearchChange,
  sensors,
  activeDragNote,
  onDragStart,
  onDragEnd,
  onCreateNote,
  onOpenNewFolder,
  onOpenNewVault,
  onDeleteNote,
  onDeleteFolder,
  onDeleteVault,
  onTogglePin,
  onNoteIconChange,
  onFolderIconChange,
  onKindChange,
  onMoveNote,
}: SidebarProps) {
  const [currentVaultId, setCurrentVaultId] = useAtom(currentVaultAtom);
  const [viewsPaneOpen, setViewsPaneOpen] = useAtom(viewsPaneOpenAtom);
  const routerState = useRouterState();
  useAtomValue(pluginRegistryVersionAtom);
  const pluginPages = pluginRegistry.getPages();
  const authUser = useAtomValue(authUserAtom);
  const setAuthUser = useSetAtom(authUserAtom);
  const navigate = useNavigate();

  function handleLogout() {
    authStorage.clear();
    setAuthUser(null);
    void navigate({ to: "/login" });
  }

  const currentVault = vaults.find((v) => v.id === currentVaultId) ?? null;
  const regularNotes = notes.filter((n) => n.type === "note");
  const pinnedNotes = regularNotes.filter((n) => n.pinned);
  const quickNoteCount = notes.filter((n) => n.type === "quick").length;
  const unfolderedNotes = regularNotes
    .filter(
      (n) =>
        !n.folderId &&
        !n.pinned &&
        (!search || n.title.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());

  const isOnQuickNotes = routerState.location.pathname === "/quick-notes";
  const isOnGraph = routerState.location.pathname === "/graph";
  const isOnTags = routerState.location.pathname === "/tags";
  const isOnCanvases = routerState.location.pathname.startsWith("/canvas");
  const isOnReminders = routerState.location.pathname === "/reminders";
  const isOnSettings = routerState.location.pathname === "/settings";

  const { data: canvasResults = [] } = useQuery({
    queryKey: canvasKeys.search(search),
    queryFn: () =>
      getCanvases({ ...(currentVaultId ? { vaultId: currentVaultId } : {}), q: search }),
    enabled: search.length > 0,
  });

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
          <Menu.Divider />
          <Menu.Item onClick={() => onOpenNewFolder()}>New Folder</Menu.Item>
        </Menu.Dropdown>
      </Menu>

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
            {pinnedNotes.length > 0 && (
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

            {/* Canvases */}
            <Link to="/canvases" style={{ textDecoration: "none" }}>
              <NavLink
                component="div"
                label={<Text size="sm">Canvases</Text>}
                leftSection={<IconLayout size={14} />}
                active={isOnCanvases}
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

            {/* Canvas search results */}
            {search && canvasResults.length > 0 && (
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
                  Canvases
                </Text>
                {canvasResults.map((canvas) => (
                  <Link
                    key={canvas.id}
                    to="/canvas/$canvasId"
                    params={{ canvasId: canvas.id }}
                    style={{ textDecoration: "none" }}
                  >
                    <NavLink
                      component="div"
                      label={<Text size="sm">{canvas.title}</Text>}
                      leftSection={<IconLayout size={14} />}
                    />
                  </Link>
                ))}
              </>
            )}

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
                  search={search}
                  onCreateNote={(folderId) => onCreateNote("note", folderId)}
                  onCreateFolder={onOpenNewFolder}
                  onDelete={onDeleteFolder}
                  onDeleteNote={onDeleteNote}
                  onTogglePin={onTogglePin}
                  onNoteIconChange={onNoteIconChange}
                  onIconChange={onFolderIconChange}
                  onNoteKindChange={onKindChange}
                  onMoveNote={onMoveNote}
                />
              ))}

            {/* Unfoldered notes */}
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
          </Stack>
        </ScrollArea>

        <DragOverlay>
          {activeDragNote ? (
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
                <IconFile size={14} />
                <Text size="sm">{activeDragNote.title || "Untitled"}</Text>
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
