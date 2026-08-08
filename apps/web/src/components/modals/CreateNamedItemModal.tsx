import { useState } from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";

/**
 * "Create a thing with a name" modal.
 *
 * CreateFolderModal and CreateVaultModal were byte-identical apart from two strings — and
 * the vault one still carried the folder placeholder ("My Notes") from the copy-paste.
 */
export function CreateNamedItemModal({
  opened,
  onClose,
  onCreate,
  title,
  label,
  placeholder,
}: {
  opened: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  title: string;
  label: string;
  placeholder: string;
}) {
  const [name, setName] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
  }

  function handleClose() {
    setName("");
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="sm">
      <Stack>
        <TextInput
          label={label}
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
