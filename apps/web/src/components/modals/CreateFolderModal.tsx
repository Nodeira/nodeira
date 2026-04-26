import { useState } from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";

export function CreateFolderModal({
  opened,
  onClose,
  onCreate,
}: {
  opened: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
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
    <Modal opened={opened} onClose={handleClose} title="New Folder" size="sm">
      <Stack>
        <TextInput
          label="Folder name"
          placeholder="My Notes"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
