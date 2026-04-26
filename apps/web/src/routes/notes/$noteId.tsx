import { createFileRoute } from "@tanstack/react-router";
import { NoteEditor } from "../../components/NoteEditor.js";
import { queryClient } from "../../lib/queryClient.js";
import { getNote, notesKeys } from "../../lib/api.js";

export const Route = createFileRoute("/notes/$noteId")({
  validateSearch: (search: Record<string, unknown>): { new?: boolean } => {
    const isNew = search.new === "true" || search.new === true;
    return isNew ? { new: true } : {};
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData({
      queryKey: notesKeys.detail(params.noteId),
      queryFn: () => getNote(params.noteId),
    }),
  component: NoteEditorPage,
});

function NoteEditorPage() {
  const { noteId } = Route.useParams();
  const { new: isNew } = Route.useSearch();
  const note = Route.useLoaderData();
  return <NoteEditor key={noteId} noteId={noteId} isNew={isNew ?? false} initialTitle={note.title} />;
}
