import { createFileRoute, redirect } from "@tanstack/react-router";
import { NoteEditor } from "../../components/NoteEditor.js";
import { queryClient } from "../../lib/queryClient.js";
import { getNote, notesKeys } from "../../lib/api.js";
import { authStorage } from "../../lib/authStorage.js";

/**
 * Chrome-less editor surface embedded by the native Android app's WebView.
 *
 * Renders only `NoteEditor` (no AppShell / sidebar). The native shell injects
 * `window.nodeiraNative` (server URLs) and the JWT into localStorage before
 * loading `/embed/note/<id>`, so REST + Yjs sync point at the user's server.
 */
export const Route = createFileRoute("/embed/note/$noteId")({
  beforeLoad: () => {
    if (!authStorage.getToken()) {
      throw redirect({ to: "/login" });
    }
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData({
      queryKey: notesKeys.detail(params.noteId),
      queryFn: () => getNote(params.noteId),
    }),
  component: EmbeddedNoteEditor,
});

function EmbeddedNoteEditor() {
  const { noteId } = Route.useParams();
  const note = Route.useLoaderData();
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <NoteEditor key={noteId} noteId={noteId} initialTitle={note.title} />
    </div>
  );
}
