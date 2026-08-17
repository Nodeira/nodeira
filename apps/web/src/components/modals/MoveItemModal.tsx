import { Button, Group, Modal, Select, Stack } from "@mantine/core";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { foldersKeys, getFolders, getVaults, vaultsKeys } from "../../lib/api.js";

/** The subset of a note or canvas this modal needs — kept type-agnostic so both share it. */
export interface MoveItemTarget {
  id: string;
  vaultId: string | null;
  folderId: string | null;
  label: string;
}

interface MoveItemContentProps {
  target: MoveItemTarget;
  onClose: () => void;
  onMove: (id: string, vaultId: string | null, folderId: string | null) => void;
}

function MoveItemContent({ target, onClose, onMove }: MoveItemContentProps) {
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(target.vaultId);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(target.folderId);

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
            onMove(target.id, selectedVaultId, selectedFolderId);
            onClose();
          }}
        >
          Move
        </Button>
      </Group>
    </Stack>
  );
}

/** Shared "move to folder/vault" modal for both notes and canvases. */
export function MoveItemModal({
  target,
  itemLabel = "item",
  onClose,
  onMove,
}: {
  target: MoveItemTarget | null;
  itemLabel?: string;
  onClose: () => void;
  onMove: (id: string, vaultId: string | null, folderId: string | null) => void;
}) {
  // Same reasoning as DeleteConfirmModal: Mantine keeps rendering this modal's children
  // during its own closing transition, after `target` has already gone back to null —
  // without this, the dialog visibly blanks out (and its title reverts to the generic
  // fallback) for the fade's duration. Sticking with the last non-null value fixes both.
  const [lastTarget, setLastTarget] = useState<MoveItemTarget | null>(null);
  const [lastLabel, setLastLabel] = useState(itemLabel);
  useEffect(() => {
    if (target) {
      setLastTarget(target);
      setLastLabel(itemLabel);
    }
  }, [target, itemLabel]);
  const display = target ?? lastTarget;
  const displayLabel = target ? itemLabel : lastLabel;

  return (
    <Modal opened={target !== null} onClose={onClose} title={`Move ${displayLabel}`} size="sm">
      {display && (
        <MoveItemContent key={display.id} target={display} onClose={onClose} onMove={onMove} />
      )}
    </Modal>
  );
}
