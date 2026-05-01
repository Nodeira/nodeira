import { Button, Group, Modal, Stack, Text } from "@mantine/core";

export type DeleteTarget = { type: "note" | "folder" | "vault"; id: string; name: string };

export function DeleteConfirmModal({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const label = target?.type ?? "item";
  return (
    <Modal opened={target !== null} onClose={onClose} title={`Delete ${label}?`} size="sm">
      <Stack>
        <Text size="sm">
          Are you sure you want to delete &ldquo;{target?.name}&rdquo;?
          {target?.type === "folder" && <> Notes inside will be moved to the root.</>}
          {target?.type === "vault" && (
            <> The vault must be empty — move or delete its notes and folders first.</>
          )}{" "}
          This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
