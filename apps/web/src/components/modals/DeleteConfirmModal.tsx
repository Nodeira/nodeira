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
  /** true for a "Delete forever" action out of Trash — permanent, no trash safety net. */
  permanent = false,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
  permanent?: boolean;
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
        {permanent ? (
          <Text size="sm">
            This will permanently delete &ldquo;{display?.name}&rdquo;. This cannot be undone.
          </Text>
        ) : (
          <Text size="sm">
            Move &ldquo;{display?.name}&rdquo; to trash?
            {display?.type === "folder" && (
              <>
                {" "}
                Everything inside — notes, canvases, and subfolders — will be moved to trash too.
              </>
            )}
            {display?.type === "vault" && (
              <> The vault must be empty — move or delete its notes and folders first.</>
            )}
            {display?.type !== "vault" && <> You can restore it from Trash within 30 days.</>}
          </Text>
        )}
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
