import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";

export type DeleteTarget = {
  type: "note" | "canvas" | "folder" | "vault";
  id: string;
  name: string;
};

export function DeleteConfirmModal({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // Mantine keeps rendering the modal's children during its own closing transition, after
  // `target` has already gone back to null — without this, the dialog visibly flashes
  // "Delete item?" with a blank name for the fade's duration. Keeping the last non-null
  // target around for display (while `opened` still tracks the real target) fixes that.
  const [lastTarget, setLastTarget] = useState<DeleteTarget | null>(null);
  useEffect(() => {
    if (target) setLastTarget(target);
  }, [target]);
  const display = target ?? lastTarget;
  const label = display?.type ?? "item";
  return (
    <Modal opened={target !== null} onClose={onClose} title={`Delete ${label}?`} size="sm">
      <Stack>
        <Text size="sm">
          Are you sure you want to delete &ldquo;{display?.name}&rdquo;?
          {display?.type === "folder" && <> Notes inside will be moved to the root.</>}
          {display?.type === "vault" && (
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
