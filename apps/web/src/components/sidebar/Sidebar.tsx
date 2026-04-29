import {
  IconBolt,
  IconChevronDown,
  IconFile,
  IconLayoutColumns,
  IconPlus,
  IconSettings,
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
import { Link, useRouterState } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { currentVaultAtom, viewsPaneOpenAtom } from "../../store/atoms.js";
import { SortableNoteItem } from "./SortableNoteItem.js";
import { FolderNavItem } from "./FolderNavItem.js";
import type { Folder, NoteMetadata, Vault } from "@nodeira/shared-types";

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
  onOpenNewFolder: () => void;
  onOpenNewVault: () => void;
  onDeleteNote: (id: string, name: string) => void;
  onDeleteFolder: (id: string, name: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNoteIconChange: (id: string, icon: string | null) => void;
  onFolderIconChange: (id: string, icon: string | null) => void;
  onKindChange: (id: string, kind: string | null) => void;
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
  onTogglePin,
  onNoteIconChange,
  onFolderIconChange,
  onKindChange,
}: SidebarProps) {
  const [currentVaultId, setCurrentVaultId] = useAtom(currentVaultAtom);
  const [viewsPaneOpen, setViewsPaneOpen] = useAtom(viewsPaneOpenAtom);
  const routerState = useRouterState();

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
          <Menu.Item onClick={onOpenNewFolder}>New Folder</Menu.Item>
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

            {folders.map((folder) => {
              const folderNotes = regularNotes.filter((n) => n.folderId === folder.id);
              return (
                <FolderNavItem
                  key={folder.id}
                  folder={folder}
                  notes={folderNotes}
                  search={search}
                  onCreateNote={(folderId) => onCreateNote("note", folderId)}
                  onDelete={onDeleteFolder}
                  onDeleteNote={onDeleteNote}
                  onTogglePin={onTogglePin}
                  onNoteIconChange={onNoteIconChange}
                  onIconChange={onFolderIconChange}
                  onNoteKindChange={onKindChange}
                />
              );
            })}

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
          <NavLink
            component="div"
            label="NA"
            leftSection={
              <Avatar size="sm" color="blue" radius="xl">
                NA
              </Avatar>
            }
            style={{ cursor: "default" }}
          />
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
