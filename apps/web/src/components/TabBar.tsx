import { useEffect, useRef, useState } from "react";
import {
  IconFile,
  IconLayout,
  IconLayoutSidebarRight,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import { ActionIcon, Group, Paper, Text } from "@mantine/core";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import {
  openTabsAtom,
  asidePanelOpenAtom,
  fullscreenPaneAtom,
  currentVaultAtom,
} from "../store/atoms.js";
import {
  getNotes,
  notesKeys,
  getCanvases,
  canvasKeys,
  getAppState,
  patchAppState,
} from "../lib/api.js";

type ContextMenuState = { tabId: string; x: number; y: number } | null;

// Tabs are keyed by note id, or `canvas:<id>` for canvases, so a single string[]
// (persisted as-is in app state) can hold both kinds. Bare ids are notes, which
// keeps previously-saved tab lists backwards-compatible.
const CANVAS_PREFIX = "canvas:";
const isCanvasTab = (id: string) => id.startsWith(CANVAS_PREFIX);
const canvasIdOf = (id: string) => id.slice(CANVAS_PREFIX.length);

export function TabBar() {
  const [tabs, setTabs] = useAtom(openTabsAtom);
  const [asideOpen, setAsideOpen] = useAtom(asidePanelOpenAtom);
  const [fullscreenPane, setFullscreenPane] = useAtom(fullscreenPaneAtom);
  const [currentVaultId] = useAtom(currentVaultAtom);
  const editorFullscreen = fullscreenPane === "editor";
  const navigate = useNavigate();
  const routerState = useRouterState();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  const initializedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: notes = [] } = useQuery({ queryKey: notesKeys.all, queryFn: () => getNotes() });
  const { data: canvases = [] } = useQuery({
    queryKey: canvasKeys.all,
    queryFn: () => getCanvases(),
  });

  const noteMatch = routerState.location.pathname.match(/^\/notes\/([^/]+)$/);
  const canvasMatch = routerState.location.pathname.match(/^\/canvas\/([^/]+)$/);
  const currentNoteId = noteMatch?.[1] ?? null;
  const currentTabId = currentNoteId ?? (canvasMatch ? `${CANVAS_PREFIX}${canvasMatch[1]}` : null);

  function navigateToTab(id: string) {
    if (isCanvasTab(id)) {
      void navigate({ to: "/canvas/$canvasId", params: { canvasId: canvasIdOf(id) } });
    } else {
      void navigate({ to: "/notes/$noteId", params: { noteId: id } });
    }
  }

  // Load persisted state on mount; restore active note if opening at root
  useEffect(() => {
    getAppState()
      .then(({ openTabs, activeNoteId }) => {
        if (openTabs.length > 0) setTabs(openTabs);
        if (activeNoteId && routerState.location.pathname === "/") {
          void navigate({ to: "/notes/$noteId", params: { noteId: activeNoteId } });
        }
        initializedRef.current = true;
      })
      .catch(() => {
        initializedRef.current = true;
      });
  }, []);

  // Sync current route into open tabs
  useEffect(() => {
    if (currentTabId && !tabs.includes(currentTabId)) {
      setTabs((prev) => [...prev, currentTabId]);
    }
  }, [currentTabId]);

  // Persist tabs + active note to DB (debounced). activeNoteId is only updated
  // while on a note route, so opening a canvas doesn't clobber the note to
  // restore at the next root visit.
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      patchAppState({
        openTabs: tabs,
        ...(currentNoteId !== null ? { activeNoteId: currentNoteId } : {}),
      }).catch(console.error);
    }, 500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [tabs, currentTabId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [contextMenu]);

  if (!currentTabId && tabs.length === 0) return null;

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== id);
      if (id === currentTabId) {
        const idx = prev.indexOf(id);
        const nextActive = next[Math.max(0, idx - 1)];
        if (nextActive) {
          navigateToTab(nextActive);
        } else {
          void navigate({ to: "/" });
        }
      }
      return next;
    });
  }

  function closeOtherTabs(id: string) {
    setTabs([id]);
    if (id !== currentTabId) {
      navigateToTab(id);
    }
  }

  function closeTabsToRight(id: string) {
    setTabs((prev) => {
      const idx = prev.indexOf(id);
      const next = prev.slice(0, idx + 1);
      if (currentTabId && !next.includes(currentTabId)) {
        navigateToTab(id);
      }
      return next;
    });
  }

  function closeTabsNotInVault(_id: string) {
    setTabs((prev) => {
      const next = prev.filter((tabId) => {
        const vaultId = isCanvasTab(tabId)
          ? canvases.find((c) => c.id === canvasIdOf(tabId))?.vaultId
          : notes.find((n) => n.id === tabId)?.vaultId;
        return vaultId === currentVaultId;
      });
      if (currentTabId && !next.includes(currentTabId)) {
        const fallback = next[next.length - 1];
        if (fallback) {
          navigateToTab(fallback);
        } else {
          void navigate({ to: "/" });
        }
      }
      return next;
    });
  }

  return (
    <>
      <div
        style={{
          height: 36,
          flexShrink: 0,
          borderBottom: "1px solid var(--mantine-color-default-border)",
          display: "flex",
          alignItems: "stretch",
          background: "var(--mantine-color-default-hover)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch", flex: 1, overflow: "hidden" }}>
          {tabs.map((id) => {
            const isCanvas = isCanvasTab(id);
            const entityId = isCanvas ? canvasIdOf(id) : id;
            const title = isCanvas
              ? canvases.find((c) => c.id === entityId)?.title
              : notes.find((n) => n.id === entityId)?.title;
            const TabIcon = isCanvas ? IconLayout : IconFile;
            const isActive = id === currentTabId;
            return (
              <div
                key={id}
                onClick={() => {
                  if (!isActive) navigateToTab(id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ tabId: id, x: e.clientX, y: e.clientY });
                }}
                style={{
                  padding: "0 12px",
                  minWidth: 120,
                  maxWidth: 200,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: isActive ? "default" : "pointer",
                  background: isActive ? "var(--mantine-color-body)" : "transparent",
                  borderRight: "1px solid var(--mantine-color-default-border)",
                  borderTop: isActive
                    ? "2px solid var(--mantine-primary-color-filled)"
                    : "2px solid transparent",
                  userSelect: "none",
                }}
              >
                <TabIcon
                  size={13}
                  style={{
                    color: isActive
                      ? "var(--mantine-primary-color-filled)"
                      : "var(--mantine-color-dimmed)",
                    flexShrink: 0,
                  }}
                />
                <Text
                  size="xs"
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: isActive ? "var(--mantine-color-text)" : "var(--mantine-color-dimmed)",
                  }}
                >
                  {title || "Untitled"}
                </Text>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    color: "var(--mantine-color-dimmed)",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--mantine-color-default-border)";
                    (e.currentTarget as HTMLDivElement).style.color = "var(--mantine-color-text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    (e.currentTarget as HTMLDivElement).style.color = "var(--mantine-color-dimmed)";
                  }}
                >
                  ×
                </div>
              </div>
            );
          })}
        </div>

        <Group px="xs" gap={4} style={{ flexShrink: 0 }}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => setFullscreenPane(editorFullscreen ? null : "editor")}
            title={editorFullscreen ? "Exit distraction-free mode" : "Distraction-free mode"}
          >
            {editorFullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
          </ActionIcon>
          <ActionIcon
            variant={asideOpen ? "light" : "subtle"}
            size="sm"
            onClick={() => setAsideOpen((o) => !o)}
            title="Toggle info panel"
          >
            <IconLayoutSidebarRight size={15} />
          </ActionIcon>
        </Group>
      </div>

      {contextMenu && (
        <Paper
          shadow="md"
          withBorder
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            minWidth: 200,
            padding: "4px 0",
            overflow: "hidden",
          }}
        >
          {[
            { label: "Close Tab", action: () => closeTab(contextMenu.tabId) },
            { label: "Close Other Tabs", action: () => closeOtherTabs(contextMenu.tabId) },
            { label: "Close Tabs to the Right", action: () => closeTabsToRight(contextMenu.tabId) },
            {
              label: "Close Tabs Not in This Vault",
              action: () => closeTabsNotInVault(contextMenu.tabId),
            },
          ].map(({ label, action }) => (
            <div
              key={label}
              onClick={() => {
                action();
                setContextMenu(null);
              }}
              style={{
                padding: "6px 16px",
                cursor: "pointer",
                fontSize: "var(--mantine-font-size-sm)",
                color: "var(--mantine-color-text)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "var(--mantine-color-default-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
            >
              {label}
            </div>
          ))}
        </Paper>
      )}
    </>
  );
}
