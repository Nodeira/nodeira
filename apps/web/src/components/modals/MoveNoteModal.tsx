import { Button, Group, Modal, Select, Stack } from "@mantine/core";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { foldersKeys, getFolders, getVaults, vaultsKeys } from "../../lib/api.js";
import type { NoteMetadata } from "@nodeira/shared-types";

interface MoveNoteContentProps {
  note: NoteMetadata;
  onClose: () => void;
  onMove: (noteId: string, vaultId: string | null, folderId: string | null) => void;
}

function MoveNoteContent({ note, onClose, onMove }: MoveNoteContentProps) {
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(note.vaultId ?? null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(note.folderId ?? null);

  const { data: vaults = [] } = useQuery({ queryKey: vaultsKeys.all, queryFn: getVaults });
  const { data: allFolders = [] } = useQuery({
    queryKey: foldersKeys.all,
    queryFn: () => getFolders(),
  });

  const vaultOptions = [
    { value: "", label: "No vault" },
    ...vaults.map((v) => ({ value: v.id, label: v.name })),
  ];

  const filteredFolders = selectedVaultId
    ? allFolders.filter((f) => f.vaultId === selectedVaultId)
    : allFolders.filter((f) => !f.vaultId);

  // Show the full "Parent / Child" path so nested folders are distinguishable.
  function folderPath(folder: (typeof filteredFolders)[number]): string {
    const parts = [folder.name];
    const seen = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = allFolders.find((f) => f.id === parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parentId;
    }
    return parts.join(" / ");
  }

  const folderOptions = [
    { value: "", label: "No folder" },
    ...filteredFolders.map((f) => ({ value: f.id, label: folderPath(f) })),
  ];

  function handleVaultChange(val: string | null) {
    setSelectedVaultId(val || null);
    setSelectedFolderId(null);
  }

  return (
    <Stack gap="sm">
      <Select
        label="Vault"
        data={vaultOptions}
        value={selectedVaultId ?? ""}
        onChange={handleVaultChange}
      />
      <Select
        label="Folder"
        data={folderOptions}
        value={selectedFolderId ?? ""}
        onChange={(val) => setSelectedFolderId(val || null)}
      />
      <Group justify="flex-end" mt="xs">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onMove(note.id, selectedVaultId, selectedFolderId);
            onClose();
          }}
        >
          Move
        </Button>
      </Group>
    </Stack>
  );
}

export function MoveNoteModal({
  note,
  onClose,
  onMove,
}: {
  note: NoteMetadata | null;
  onClose: () => void;
  onMove: (noteId: string, vaultId: string | null, folderId: string | null) => void;
}) {
  return (
    <Modal opened={note !== null} onClose={onClose} title="Move note" size="sm">
      {note && <MoveNoteContent key={note.id} note={note} onClose={onClose} onMove={onMove} />}
    </Modal>
  );
}
