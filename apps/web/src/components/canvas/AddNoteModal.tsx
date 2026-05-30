import { Box, Button, Group, Modal, Text, TextInput } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getNotes, notesKeys } from "../../lib/api.js";
import type { NoteMetadata } from "@nodeira/shared-types";

interface AddNoteModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (note: NoteMetadata) => void;
  vaultId?: string;
}

export function AddNoteModal({ opened, onClose, onSelect, vaultId }: AddNoteModalProps) {
  const [search, setSearch] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: notesKeys.all,
    queryFn: () => getNotes(vaultId),
    enabled: opened,
  });

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Add Note to Canvas" size="md">
      <TextInput
        placeholder="Search notes…"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="sm"
        autoFocus
      />
      <Box style={{ maxHeight: 320, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No notes found
          </Text>
        )}
        {filtered.map((note) => (
          <Box
            key={note.id}
            p="xs"
            style={{
              cursor: "pointer",
              borderRadius: 4,
              marginBottom: 2,
            }}
            className="hover-bg"
            onClick={() => {
              onSelect(note);
              onClose();
            }}
          >
            <Text size="sm" fw={500}>
              {note.title}
            </Text>
            {note.preview && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {note.preview}
              </Text>
            )}
          </Box>
        ))}
      </Box>
      <Group justify="flex-end" mt="sm">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
      </Group>
    </Modal>
  );
}
