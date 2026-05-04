import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  IconDots,
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
import { ActionIcon, Box, Button, Group, Menu, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import { destroyYjsContext, getOrCreateYjsContext } from "../providers/YjsProvider.js";
import { deleteNote, getNote, notesKeys, updateNoteTitle } from "../lib/api.js";
import { pluginRegistry, pluginRegistryVersionAtom } from "../lib/pluginRegistry.js";
import "./editor.css";

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
  isNew?: boolean;
  initialTitle?: string;
}

export function NoteEditor({ noteId, isNew, initialTitle }: NoteEditorProps) {
  const { doc } = getOrCreateYjsContext(noteId);
  const [titleValue, setTitleValue] = useState(initialTitle ?? "");
  const hasAutoSelected = useRef(false);
  const [deleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: note = null } = useQuery({
    queryKey: notesKeys.detail(noteId),
    queryFn: () => getNote(noteId),
  });

  useAtomValue(pluginRegistryVersionAtom);
  const editorHeaders = pluginRegistry.getEditorHeaders();

  // Tear down the Yjs doc + WebSocket + IndexedDB providers when this editor
  // unmounts. The route uses key={noteId}, so switching notes destroys this
  // instance and its cached entry in YjsProvider's docCache.
  useEffect(() => {
    return () => destroyYjsContext(noteId);
  }, [noteId]);

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
    ],
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

          {/* Insert table */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Control
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              title="Insert table"
              aria-label="Insert table"
            >
              <IconTable size={14} />
            </RichTextEditor.Control>
          </RichTextEditor.ControlsGroup>

          {/* Table controls — only visible when cursor is inside a table */}
          {inTable && (
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().addRowAfter().run()}
                title="Add row below"
              >
                <IconTableRow size={14} />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().deleteRow().run()}
                title="Delete row"
              >
                <IconTableRow size={14} style={{ opacity: 0.5 }} />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
                title="Add column right"
              >
                <IconTableColumn size={14} />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().deleteColumn().run()}
                title="Delete column"
              >
                <IconTableColumn size={14} style={{ opacity: 0.5 }} />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => editor?.chain().focus().deleteTable().run()}
                title="Delete table"
              >
                <IconTableOff size={14} />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>
          )}

          {/* Undo / Redo */}
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>

        <RichTextEditor.Content style={{ flex: 1, overflow: "auto" }} />
      </RichTextEditor>

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
