import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { notesKeys, purgeTrashItem, trashKeys } from "./api.js";
import { forgetYjsContext } from "../providers/YjsProvider.js";

/**
 * Permanently deletes a note straight out of trash. This is the only place that tears
 * down the note's Yjs context and drops its IndexedDB database — a trashed-but-not-yet-
 * purged note can still be restored and reopened, so useDeleteNote (trash) does not do
 * this teardown.
 */
export function usePurgeNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purgeTrashItem("note", id),
    onSuccess: (_result, id) => {
      forgetYjsContext(id);
      void qc.invalidateQueries({ queryKey: notesKeys.all });
      void qc.invalidateQueries({ queryKey: trashKeys.all });
    },
    onError: () => notifications.show({ message: "Couldn't delete note", color: "red" }),
  });
}
