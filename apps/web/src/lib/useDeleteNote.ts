import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { deleteNote, notesKeys } from "./api.js";
import { forgetYjsContext } from "../providers/YjsProvider.js";

/**
 * The single way to delete a note.
 *
 * There were three separate delete paths — the sidebar's confirm modal, the editor's own
 * inline modal, and the quick-notes grid (which deleted with no confirmation at all) —
 * and each invalidated a different query key. None of them tore down the note's Yjs
 * context, so the WebSocket stayed connected to /sync/<deletedId> and the note's
 * IndexedDB database was left behind permanently.
 *
 * Teardown runs on success rather than up front: if the server rejects the delete, the
 * open editor keeps a working document.
 */
export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: (_result, id) => {
      forgetYjsContext(id);
      // notesKeys.all, never a vault-scoped key: query keys match by prefix, so this
      // refreshes the byVault entries too. The reverse is not true.
      void qc.invalidateQueries({ queryKey: notesKeys.all });
    },
    onError: () => notifications.show({ message: "Couldn't delete note", color: "red" }),
  });
}
