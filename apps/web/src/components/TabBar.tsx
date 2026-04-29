import { useEffect } from "react";
import { IconFile, IconLayoutSidebarRight, IconMaximize, IconMinimize } from "@tabler/icons-react";
import { ActionIcon, Group, Text } from "@mantine/core";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { openTabsAtom, asidePanelOpenAtom, fullscreenPaneAtom } from "../store/atoms.js";
import { getNotes, notesKeys } from "../lib/api.js";

export function TabBar() {
  const [tabs, setTabs] = useAtom(openTabsAtom);
  const [asideOpen, setAsideOpen] = useAtom(asidePanelOpenAtom);
  const [fullscreenPane, setFullscreenPane] = useAtom(fullscreenPaneAtom);
  const editorFullscreen = fullscreenPane === "editor";
  const navigate = useNavigate();
  const routerState = useRouterState();

  const { data: notes = [] } = useQuery({ queryKey: notesKeys.all, queryFn: () => getNotes() });

  const match = routerState.location.pathname.match(/^\/notes\/([^/]+)$/);
  const currentNoteId = match?.[1] ?? null;

  // Sync current route into open tabs (legitimate external-system sync)
  useEffect(() => {
    if (currentNoteId && !tabs.includes(currentNoteId)) {
      setTabs((prev) => [...prev, currentNoteId]);
    }
  }, [currentNoteId]);

  if (!currentNoteId && tabs.length === 0) return null;

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== id);
      if (id === currentNoteId) {
        const idx = prev.indexOf(id);
        const nextActive = next[Math.max(0, idx - 1)];
        if (nextActive) {
          void navigate({ to: "/notes/$noteId", params: { noteId: nextActive } });
        } else {
          void navigate({ to: "/" });
        }
      }
      return next;
    });
  }

  return (
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
          const note = notes.find((n) => n.id === id);
          const isActive = id === currentNoteId;
          return (
            <div
              key={id}
              onClick={() => {
                if (!isActive) void navigate({ to: "/notes/$noteId", params: { noteId: id } });
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
              <IconFile
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
                {note?.title || "Untitled"}
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
  );
}
