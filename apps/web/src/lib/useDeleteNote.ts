import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { deleteNote, notesKeys, trashKeys } from "./api.js";

/**
 * The single way to trash a note.
 *
 * There were three separate delete paths — the sidebar's confirm modal, the editor's own
 * inline modal, and the quick-notes grid (which deleted with no confirmation at all) —
 * and each invalidated a different query key.
 *
 * This only moves the note to trash (soft delete); it does NOT tear down the note's Yjs
 * context or drop its IndexedDB database, because a trashed note can still be restored
 * and reopened. That teardown only happens on a permanent purge — see usePurgeNote.
 */
export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      // notesKeys.all, never a vault-scoped key: query keys match by prefix, so this
      // refreshes the byVault entries too. The reverse is not true.
      void qc.invalidateQueries({ queryKey: notesKeys.all });
      void qc.invalidateQueries({ queryKey: trashKeys.all });
    },
    onError: () => notifications.show({ message: "Couldn't delete note", color: "red" }),
  });
}
