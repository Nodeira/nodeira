import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Box,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconTag } from "@tabler/icons-react";
import { getTags, getNotesByTag, tagsKeys } from "../../lib/api.js";

const tagsSearchSchema = z.object({
  tag: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/tags")({
  validateSearch: tagsSearchSchema,
  component: TagsPage,
});

function TagsPage() {
  const { tag: selectedTag } = Route.useSearch();
  const navigate = useNavigate({ from: "/tags" });

  const { data: allTags = [] } = useQuery({
    queryKey: tagsKeys.all,
    queryFn: getTags,
  });

  const { data: tagNotes = [] } = useQuery({
    queryKey: tagsKeys.forTag(selectedTag ?? ""),
    queryFn: () => getNotesByTag(selectedTag!),
    enabled: !!selectedTag,
  });

  function selectTag(tag: string) {
    void navigate({ search: (prev) => ({ ...prev, tag }) });
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Group
        px="md"
        py="xs"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Title order={5} style={{ fontWeight: 600 }}>Tags</Title>
        <Text size="xs" c="dimmed">{allTags.length} tag{allTags.length !== 1 ? "s" : ""}</Text>
      </Group>

      <Box style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Tag list */}
        <Box
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid var(--mantine-color-default-border)",
            overflow: "auto",
          }}
        >
          <ScrollArea h="100%">
            <Stack gap={2} p="xs">
              {allTags.length === 0 && (
                <Text size="sm" c="dimmed" px={8} pt={8}>
                  No tags yet. Type #tag in any note.
                </Text>
              )}
              {allTags.map(({ tag, count }) => (
                <NavLink
                  key={tag}
                  component="button"
                  label={
                    <Group gap={4} justify="space-between">
                      <Text size="sm">#{tag}</Text>
                      <Text size="xs" c="dimmed">{count}</Text>
                    </Group>
                  }
                  leftSection={<IconTag size={13} />}
                  active={tag === selectedTag}
                  onClick={() => selectTag(tag)}
                />
              ))}
            </Stack>
          </ScrollArea>
        </Box>

        {/* Notes for selected tag */}
        <Box style={{ flex: 1, overflow: "auto" }}>
          {!selectedTag ? (
            <Text size="sm" c="dimmed" p="md">Select a tag to see notes</Text>
          ) : (
            <ScrollArea h="100%">
              <Stack gap={2} p="xs">
                <Text size="xs" fw={600} tt="uppercase" c="dimmed" px={8} pt={4} pb={2} style={{ letterSpacing: "0.08em" }}>
                  #{selectedTag} — {tagNotes.length} note{tagNotes.length !== 1 ? "s" : ""}
                </Text>
                {tagNotes.length === 0 && (
                  <Text size="sm" c="dimmed" px={8}>No notes with this tag.</Text>
                )}
                {tagNotes.map((note) => (
                  <Link key={note.id} to="/notes/$noteId" params={{ noteId: note.id }} style={{ textDecoration: "none" }}>
                    <NavLink
                      component="div"
                      label={note.title || "Untitled"}
                      description={note.preview}
                    />
                  </Link>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Box>
      </Box>
    </Box>
  );
}
