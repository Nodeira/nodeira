import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  IconDots,
  IconFileTypePdf,
  IconLayout,
  IconTable,
  IconTableColumn,
  IconTableOff,
  IconTableRow,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { Link, RichTextEditor } from "@mantine/tiptap";
import { createLowlight, common } from "lowlight";
import { ActionIcon, Badge, Box, Button, Group, Menu, Modal, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { destroyYjsContext, getOrCreateYjsContext } from "../providers/YjsProvider.js";
import { deleteNote, getNote, getNotes, getTags, canvasKeys, getCanvases, notesKeys, tagsKeys, updateNoteTitle, uploadPdf } from "../lib/api.js";
import type { NoteMetadata } from "@nodeira/shared-types";
import { PdfEmbed } from "./PdfEmbed.js";
import { WikiLink } from "./WikiLink.js";
import { HashTag } from "./HashTag.js";
import { CanvasEmbed } from "./CanvasEmbed.js";
import { pluginRegistry, pluginRegistryVersionAtom } from "../lib/pluginRegistry.js";
import "./editor.css";

interface WikiSearchState {
  query: string;
  from: number;
  coords: { top: number; left: number };
}

interface TagSearchState {
  query: string;
  from: number;
  coords: { top: number; left: number };
}

function WikiLinkPicker({
  query,
  coords,
  notes,
  onSelect,
}: {
  query: string;
  coords: { top: number; left: number };
  notes: NoteMetadata[];
  onSelect: (note: NoteMetadata) => void;
}) {
  const filtered = notes
    .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <Paper
      shadow="md"
      p={4}
      style={{
        position: "fixed",
        top: coords.top + 4,
        left: coords.left,
        zIndex: 9999,
        maxHeight: 240,
        overflow: "auto",
        minWidth: 200,
        maxWidth: 350,
      }}
    >
      <Stack gap={2}>
        {filtered.map((note) => (
          <button
            key={note.id}
            className="wiki-pick-item"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(note);
            }}
          >
            {note.title || "Untitled"}
          </button>
        ))}
      </Stack>
    </Paper>
  );
}

function TagPicker({
  query,
  coords,
  tags,
  onSelect,
}: {
  query: string;
  coords: { top: number; left: number };
  tags: { tag: string; count: number }[];
  onSelect: (tag: string) => void;
}) {
  const filtered = tags
    .filter((t) => t.tag.toLowerCase().startsWith(query.toLowerCase()))
    .slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <Paper
      shadow="md"
      p={4}
      style={{
        position: "fixed",
        top: coords.top + 4,
        left: coords.left,
        zIndex: 9999,
        maxHeight: 240,
        overflow: "auto",
        minWidth: 150,
        maxWidth: 300,
      }}
    >
      <Stack gap={2}>
        {filtered.map(({ tag, count }) => (
          <button
            key={tag}
            className="wiki-pick-item"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(tag);
            }}
          >
            #{tag}
            <span style={{ color: "var(--mantine-color-dimmed)", fontSize: "0.75em", marginLeft: 4 }}>
              {count}
            </span>
          </button>
        ))}
      </Stack>
    </Paper>
  );
}

type JsonNode = { type: string; attrs?: Record<string, unknown>; content?: JsonNode[] };

function extractEditorTags(node: JsonNode): string[] {
  const tags: string[] = [];
  if (node.type === "hashTag" && typeof node.attrs?.tag === "string") {
    tags.push(node.attrs.tag);
  }
  for (const child of node.content ?? []) {
    tags.push(...extractEditorTags(child));
  }
  return [...new Set(tags)];
}

const lowlight = createLowlight(common);

const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "diff", label: "Diff" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "ini", label: "INI" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "lua", label: "Lua" },
  { value: "makefile", label: "Makefile" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scala", label: "Scala" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];

interface NoteEditorProps {
  noteId: string;
  isNew?: boolean;
  initialTitle?: string;
}

export function NoteEditor({ noteId, isNew, initialTitle }: NoteEditorProps) {
  const { doc } = getOrCreateYjsContext(noteId);
  const [titleValue, setTitleValue] = useState(initialTitle ?? "");
  const hasAutoSelected = useRef(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [canvasPickerOpen, { open: openCanvasPicker, close: closeCanvasPicker }] = useDisclosure(false);
  const [deleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [wikiSearch, setWikiSearch] = useState<WikiSearchState | null>(null);
  const wikiSearchRef = useRef<WikiSearchState | null>(null);
  wikiSearchRef.current = wikiSearch;
  const [tagSearch, setTagSearch] = useState<TagSearchState | null>(null);
  const tagSearchRef = useRef<TagSearchState | null>(null);
  tagSearchRef.current = tagSearch;

  const { data: note = null } = useQuery({
    queryKey: notesKeys.detail(noteId),
    queryFn: () => getNote(noteId),
  });

  const { data: allNotes = [] } = useQuery({
    queryKey: notesKeys.all,
    queryFn: () => getNotes(),
  });

  const { data: allTags = [] } = useQuery({
    queryKey: tagsKeys.all,
    queryFn: getTags,
  });

  const { data: allCanvases = [] } = useQuery({
    queryKey: canvasKeys.all,
    queryFn: () => getCanvases(),
    enabled: canvasPickerOpen,
  });

  useAtomValue(pluginRegistryVersionAtom);
  const editorHeaders = pluginRegistry.getEditorHeaders();

  // Tear down the Yjs doc + WebSocket + IndexedDB providers when this editor
  // unmounts. The route uses key={noteId}, so switching notes destroys this
  // instance and its cached entry in YjsProvider's docCache.
  useEffect(() => {
    return () => destroyYjsContext(noteId);
  }, [noteId]);

  // Close wiki picker on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWikiSearch(null);
        setTagSearch(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const selectWikiLink = useCallback(
    (note: NoteMetadata) => {
      if (!editorRef.current || !wikiSearchRef.current) return;
      const editor = editorRef.current;
      const { from } = editor.state.selection;
      editor
        .chain()
        .focus()
        .deleteRange({ from: wikiSearchRef.current.from, to: from })
        .insertContent({ type: "wikiLink", attrs: { noteId: note.id, title: note.title } })
        .run();
      setWikiSearch(null);
    },
    [],
  );

  const selectTag = useCallback((tag: string) => {
    if (!editorRef.current || !tagSearchRef.current) return;
    const editor = editorRef.current;
    const { from } = editor.state.selection;
    editor
      .chain()
      .focus()
      .deleteRange({ from: tagSearchRef.current.from, to: from })
      .insertContent({ type: "hashTag", attrs: { tag } })
      .run();
    setTagSearch(null);
  }, []);

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ undoRedo: false, codeBlock: false, link: false }),
      Collaboration.configure({ document: doc }),
      Link,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Image,
      PdfEmbed,
      CanvasEmbed,
      WikiLink,
      HashTag,
    ],
    onUpdate: ({ editor }) => {
      const { from } = editor.state.selection;
      const $from = editor.state.selection.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset);
      const wikiMatch = textBefore.match(/\[\[([^\]]*)$/);
      const tagMatch = textBefore.match(/#([\w-]*)$/);
      if (wikiMatch) {
        try {
          const triggerStart = from - wikiMatch[0].length;
          const coords = editor.view.coordsAtPos(triggerStart);
          setWikiSearch({ query: wikiMatch[1] ?? "", from: triggerStart, coords: { top: coords.bottom, left: coords.left } });
        } catch {
          setWikiSearch(null);
        }
        setTagSearch(null);
      } else if (tagMatch) {
        try {
          const triggerStart = from - tagMatch[0].length;
          const coords = editor.view.coordsAtPos(triggerStart);
          setTagSearch({ query: tagMatch[1] ?? "", from: triggerStart, coords: { top: coords.bottom, left: coords.left } });
        } catch {
          setTagSearch(null);
        }
        setWikiSearch(null);
      } else {
        setWikiSearch(null);
        setTagSearch(null);
      }
    },
    onBlur: () => { setWikiSearch(null); setTagSearch(null); },
  });

  // Keep editorRef in sync
  editorRef.current = editor;

  const uploadPdfMutation = useMutation({
    mutationFn: uploadPdf,
    onSuccess: ({ url }, file) => {
      editor?.chain().focus().insertContent({
        type: "pdfEmbed",
        attrs: { src: url, title: file.name },
      }).run();
    },
  });

  const saveTitleMutation = useMutation({
    mutationFn: (title: string) => updateNoteTitle(noteId, title.trim() || "Untitled"),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: () => deleteNote(noteId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: notesKeys.all });
      closeDelete();
      await navigate({ to: "/" });
    },
  });

  const inTable = editor?.isActive("table") ?? false;
  const inCodeBlock = editor?.isActive("codeBlock") ?? false;
  const codeBlockLanguage = editor?.getAttributes("codeBlock").language ?? "plaintext";

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Title row */}
      <Group px="md" pt="md" pb={4} justify="space-between" align="center">
        <TextInput
          value={titleValue}
          onChange={(e) => setTitleValue(e.currentTarget.value)}
          onBlur={() => saveTitleMutation.mutate(titleValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          autoFocus={isNew}
          onFocus={(e) => {
            if (isNew && !hasAutoSelected.current) {
              hasAutoSelected.current = true;
              e.target.select();
            }
          }}
          variant="unstyled"
          placeholder="Untitled"
          style={{ flex: 1 }}
          styles={{ input: { fontSize: "1.5rem", fontWeight: 700, padding: 0 } }}
        />
        <Group gap={4}>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" title="Note options">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" onClick={openDelete}>
                Delete note
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {/* Tags extracted from note content */}
      {(() => {
        const tags = editor ? extractEditorTags(editor.getJSON() as JsonNode) : [];
        if (tags.length === 0) return null;
        return (
          <Group px="md" pb={4} gap={4}>
            {tags.map((tag) => (
              <RouterLink key={tag} to="/tags" search={{ tag }} style={{ textDecoration: "none" }}>
                <Badge size="sm" variant="light" color="indigo" style={{ cursor: "pointer" }}>
                  #{tag}
                </Badge>
              </RouterLink>
            ))}
          </Group>
        );
      })()}

      {/* Plugin editor headers (e.g. journal mood/listening) */}
      {editorHeaders.map((h) => {
        const Comp = h.component;
        return <Comp key={h.id} note={note} />;
      })}

      {/* Rich text editor with toolbar */}
      <RichTextEditor
        editor={editor}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          border: "none",
          borderRadius: 0,
        }}
      >
        <RichTextEditor.Toolbar sticky stickyOffset={0}>
          {/* Headings */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 />
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
          </RichTextEditor.ControlsGroup>

          {/* Inline formatting */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.Code />
          </RichTextEditor.ControlsGroup>

          {/* Links */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>

          {/* Lists */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.TaskList />
          </RichTextEditor.ControlsGroup>

          {/* Blocks */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Blockquote />
            <RichTextEditor.CodeBlock />
            <RichTextEditor.Hr />
          </RichTextEditor.ControlsGroup>

          {/* Language selector — only visible when cursor is inside a code block */}
          {inCodeBlock && (
            <RichTextEditor.ControlsGroup>
              <Select
                size="xs"
                data={CODE_LANGUAGES}
                value={codeBlockLanguage}
                onChange={(lang) =>
                  editor?.commands.updateAttributes("codeBlock", { language: lang ?? "plaintext" })
                }
                allowDeselect={false}
                searchable
                w={140}
                comboboxProps={{ withinPortal: true }}
                styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
              />
            </RichTextEditor.ControlsGroup>
          )}

          {/* Insert table */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Control
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              title="Insert table"
              aria-label="Insert table"
            >
              <IconTable size={14} color="var(--mantine-color-green-6)" />
            </RichTextEditor.Control>
          </RichTextEditor.ControlsGroup>

          {/* Table controls — only visible when cursor is inside a table */}
          {inTable && (
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().addRowAfter().run()}
                title="Add row below"
              >
                <IconTableRow size={14} color="var(--mantine-color-green-6)" />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().deleteRow().run()}
                title="Delete row"
              >
                <IconTableRow size={14} color="var(--mantine-color-red-6)" />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
                title="Add column right"
              >
                <IconTableColumn size={14} color="var(--mantine-color-green-6)" />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().deleteColumn().run()}
                title="Delete column"
              >
                <IconTableColumn size={14} color="var(--mantine-color-red-6)" />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().deleteTable().run()}
                title="Delete table"
              >
                <IconTableOff size={14} color="var(--mantine-color-red-6)" />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>
          )}

          {/* Undo / Redo */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>

          {/* PDF embed */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Control
              onClick={() => pdfInputRef.current?.click()}
              title="Embed PDF"
              aria-label="Embed PDF"
            >
              <IconFileTypePdf size={14} color="var(--mantine-color-green-6)" />
            </RichTextEditor.Control>
          </RichTextEditor.ControlsGroup>

          {/* Canvas embed */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Control
              onClick={openCanvasPicker}
              title="Embed Canvas"
              aria-label="Embed Canvas"
            >
              <IconLayout size={14} color="var(--mantine-color-blue-6)" />
            </RichTextEditor.Control>
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>

        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadPdfMutation.mutate(file);
            e.target.value = "";
          }}
        />

        <RichTextEditor.Content style={{ flex: 1, overflow: "auto" }} />
      </RichTextEditor>

      {/* WikiLink suggestion picker */}
      {wikiSearch && (
        <WikiLinkPicker
          query={wikiSearch.query}
          coords={wikiSearch.coords}
          notes={allNotes}
          onSelect={selectWikiLink}
        />
      )}

      {/* Tag suggestion picker */}
      {tagSearch && (
        <TagPicker
          query={tagSearch.query}
          coords={tagSearch.coords}
          tags={allTags}
          onSelect={selectTag}
        />
      )}

      {/* Canvas embed picker modal */}
      <Modal opened={canvasPickerOpen} onClose={closeCanvasPicker} title="Embed Canvas" size="md">
        <Stack gap="xs">
          {allCanvases.length === 0 ? (
            <Text size="sm" c="dimmed">No canvases found. Create one in the Canvases section first.</Text>
          ) : (
            allCanvases.map((canvas) => (
              <Box
                key={canvas.id}
                p="xs"
                style={{ cursor: "pointer", borderRadius: 4, border: "1px solid var(--mantine-color-default-border)" }}
                onClick={() => {
                  editor?.chain().focus().insertContent({ type: "canvasEmbed", attrs: { canvasId: canvas.id } }).run();
                  closeCanvasPicker();
                }}
              >
                <Text size="sm" fw={500}>{canvas.title}</Text>
                <Text size="xs" c="dimmed">{canvas.data.nodes.length} nodes</Text>
              </Box>
            ))
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCanvasPicker}>Cancel</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal opened={deleteOpen} onClose={closeDelete} title="Delete note?" size="sm">
        <Stack>
          <Text size="sm">
            Are you sure you want to delete &ldquo;{titleValue || "Untitled"}&rdquo;? This cannot be
            undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete}>
              Cancel
            </Button>
            <Button color="red" onClick={() => deleteNoteMutation.mutate()}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
