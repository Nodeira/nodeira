import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBell,
  IconClock,
  IconDots,
  IconMapPin,
  IconPlus,
  IconRepeat,
  IconTrash,
} from "@tabler/icons-react";
import type { Reminder } from "@nodeira/shared-types";
import {
  createReminder,
  deleteReminder,
  dismissReminder,
  getReminders,
  remindersKeys,
  snoozeReminder,
  type CreateReminderBody,
} from "../../lib/api.js";
import { ReminderModal } from "../../components/modals/ReminderModal.js";

export const Route = createFileRoute("/_authenticated/reminders")({
  component: RemindersPage,
});

const ACTIVE_STATUSES: Reminder["status"][] = ["SCHEDULED", "SNOOZED"];

function statusColor(status: Reminder["status"]): string {
  switch (status) {
    case "SCHEDULED":
      return "blue";
    case "SNOOZED":
      return "yellow";
    case "FIRED":
      return "green";
    case "DISMISSED":
      return "gray";
    default:
      return "red";
  }
}

function whenLabel(r: Reminder): string {
  if (r.triggerType === "LOCATION") {
    return `${r.onLeave ? "Leaving" : "Near"} ${r.locationName ?? "a place"}`;
  }
  const at = r.snoozeUntil ?? r.fireAt;
  return at ? at.toLocaleString() : "—";
}

function RemindersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: reminders = [] } = useQuery({
    queryKey: remindersKeys.all,
    queryFn: getReminders,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: remindersKeys.all });

  const createMutation = useMutation({
    mutationFn: (body: CreateReminderBody) => createReminder(body),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
    },
    onError: () => notifications.show({ message: "Couldn't create reminder", color: "red" }),
  });
  const snoozeMutation = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) => snoozeReminder(id, until),
    onSuccess: invalidate,
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissReminder(id),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: invalidate,
  });

  const active = reminders.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const past = reminders.filter((r) => !ACTIVE_STATUSES.includes(r.status));

  function snoozeBy(id: string, ms: number) {
    snoozeMutation.mutate({ id, until: new Date(Date.now() + ms).toISOString() });
  }

  const renderItem = (r: Reminder) => (
    <Paper key={r.id} withBorder p="sm" radius="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Box style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm" truncate>
              {r.title}
            </Text>
            <Badge size="xs" color={statusColor(r.status)} variant="light">
              {r.status.toLowerCase()}
            </Badge>
          </Group>
          {r.body && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {r.body}
            </Text>
          )}
          <Group gap={10} mt={4}>
            <Group gap={3}>
              {r.triggerType === "LOCATION" ? <IconMapPin size={12} /> : <IconClock size={12} />}
              <Text size="xs" c="dimmed">
                {whenLabel(r)}
              </Text>
            </Group>
            {r.recurrence && (
              <Group gap={3}>
                <IconRepeat size={12} />
                <Text size="xs" c="dimmed">
                  {r.recurrence.toLowerCase()}
                </Text>
              </Group>
            )}
            {r.targetType === "NOTE" && r.targetNoteId && (
              <Link
                to="/notes/$noteId"
                params={{ noteId: r.targetNoteId }}
                style={{ fontSize: 12 }}
              >
                Open note
              </Link>
            )}
            {r.targetType === "CANVAS" && r.targetCanvasId && (
              <Link
                to="/canvas/$canvasId"
                params={{ canvasId: r.targetCanvasId }}
                style={{ fontSize: 12 }}
              >
                Open canvas
              </Link>
            )}
          </Group>
        </Box>

        <Menu position="bottom-end" withArrow>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {ACTIVE_STATUSES.includes(r.status) && r.triggerType === "TIME" && (
              <>
                <Menu.Label>Snooze</Menu.Label>
                <Menu.Item onClick={() => snoozeBy(r.id, 60 * 60 * 1000)}>1 hour</Menu.Item>
                <Menu.Item onClick={() => snoozeBy(r.id, 3 * 60 * 60 * 1000)}>3 hours</Menu.Item>
                <Menu.Item onClick={() => snoozeBy(r.id, 24 * 60 * 60 * 1000)}>Tomorrow</Menu.Item>
                <Menu.Divider />
              </>
            )}
            {ACTIVE_STATUSES.includes(r.status) && (
              <Menu.Item onClick={() => dismissMutation.mutate(r.id)}>Dismiss</Menu.Item>
            )}
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => deleteMutation.mutate(r.id)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Paper>
  );

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Group
        px="md"
        py="xs"
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Group gap={8}>
          <IconBell size={18} />
          <Title order={5} style={{ fontWeight: 600 }}>
            Reminders
          </Title>
          <Text size="xs" c="dimmed">
            {active.length} active
          </Text>
        </Group>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalOpen(true)}>
          New reminder
        </Button>
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        <Stack gap="md" p="md" maw={680}>
          <Stack gap="xs">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
              Upcoming
            </Text>
            {active.length === 0 ? (
              <Text size="sm" c="dimmed">
                No upcoming reminders. Create one to get started.
              </Text>
            ) : (
              active.map(renderItem)
            )}
          </Stack>

          {past.length > 0 && (
            <Stack gap="xs">
              <Text
                size="xs"
                fw={600}
                tt="uppercase"
                c="dimmed"
                style={{ letterSpacing: "0.08em" }}
              >
                Past
              </Text>
              {past.map(renderItem)}
            </Stack>
          )}
        </Stack>
      </ScrollArea>

      <ReminderModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        submitting={createMutation.isPending}
      />
    </Box>
  );
}
