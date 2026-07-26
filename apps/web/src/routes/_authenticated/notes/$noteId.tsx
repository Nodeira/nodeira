import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { NoteEditor } from "../../../components/NoteEditor.js";
import { queryClient } from "../../../lib/queryClient.js";
import { getNote, notesKeys } from "../../../lib/api.js";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
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
  errorComponent: NoteNotFound,
});

// Renders when the loader fails (typically a 404 from a stale/deleted note id
// restored from persisted tabs or app state) instead of crashing the router.
function NoteNotFound() {
  return (
    <Center h="100%" p="xl">
      <Stack align="center" gap="sm">
        <Title order={3}>Note not found</Title>
        <Text c="dimmed" size="sm">
          This note may have been deleted, or the link is no longer valid.
        </Text>
        <Button component={Link} to="/" variant="light">
          Back to home
        </Button>
      </Stack>
    </Center>
  );
}

function NoteEditorPage() {
  const { noteId } = Route.useParams();
  const { new: isNew } = Route.useSearch();
  const note = Route.useLoaderData();
  return (
    <NoteEditor key={noteId} noteId={noteId} isNew={isNew ?? false} initialTitle={note.title} />
  );
}
