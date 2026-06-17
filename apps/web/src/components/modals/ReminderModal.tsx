import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconMapPin } from "@tabler/icons-react";
import type { Reminder } from "@nodeira/shared-types";
import type { CreateReminderBody } from "../../lib/api.js";

export interface ReminderTarget {
  targetType: Reminder["targetType"];
  targetNoteId?: string;
  targetCanvasId?: string;
  targetNodeId?: string;
  label?: string; // human-readable target name, shown in the modal
}

interface ReminderModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (body: CreateReminderBody) => void;
  /** Pre-fills the target when launched from a note/canvas. */
  target?: ReminderTarget;
  submitting?: boolean;
}

/** Default the time picker to one hour from now, in the input's local format. */
function defaultLocalDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderModal({
  opened,
  onClose,
  onSubmit,
  target,
  submitting,
}: ReminderModalProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [trigger, setTrigger] = useState<"TIME" | "LOCATION">("TIME");

  // TIME fields
  const [fireAtLocal, setFireAtLocal] = useState(defaultLocalDateTime());
  const [recurrence, setRecurrence] = useState<string>("");

  // LOCATION fields
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [radiusM, setRadiusM] = useState<number | "">(1609); // ~1 mile
  const [locationName, setLocationName] = useState("");
  const [onLeave, setOnLeave] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function handleSubmit() {
    const base: CreateReminderBody = {
      title: title.trim() || "Reminder",
      ...(body.trim() ? { body: body.trim() } : {}),
      triggerType: trigger,
      ...(target
        ? {
            targetType: target.targetType,
            ...(target.targetNoteId ? { targetNoteId: target.targetNoteId } : {}),
            ...(target.targetCanvasId ? { targetCanvasId: target.targetCanvasId } : {}),
            ...(target.targetNodeId ? { targetNodeId: target.targetNodeId } : {}),
          }
        : {}),
    };

    if (trigger === "TIME") {
      base.fireAt = new Date(fireAtLocal).toISOString();
      base.timezone = timezone;
      if (recurrence) base.recurrence = recurrence as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    } else {
      base.lat = typeof lat === "number" ? lat : 0;
      base.lng = typeof lng === "number" ? lng : 0;
      base.radiusM = typeof radiusM === "number" ? radiusM : 1609;
      if (locationName.trim()) base.locationName = locationName.trim();
      base.onLeave = onLeave;
    }

    onSubmit(base);
  }

  const locationValid =
    typeof lat === "number" && typeof lng === "number" && typeof radiusM === "number";

  return (
    <Modal opened={opened} onClose={onClose} title="New reminder" centered>
      <Stack gap="sm">
        {target?.label && (
          <Text size="xs" c="dimmed">
            Attached to: <b>{target.label}</b>
          </Text>
        )}

        <TextInput
          label="Title"
          placeholder="What's this about?"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          data-autofocus
          required
        />
        <Textarea
          label="Notes"
          placeholder="Optional details"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          autosize
          minRows={2}
        />

        <SegmentedControl
          value={trigger}
          onChange={(v) => setTrigger(v as "TIME" | "LOCATION")}
          data={[
            { label: "At a time", value: "TIME" },
            { label: "At a place", value: "LOCATION" },
          ]}
          fullWidth
        />

        {trigger === "TIME" ? (
          <>
            <TextInput
              label="When"
              type="datetime-local"
              value={fireAtLocal}
              onChange={(e) => setFireAtLocal(e.currentTarget.value)}
            />
            <Select
              label="Repeat"
              value={recurrence}
              onChange={(v) => setRecurrence(v ?? "")}
              data={[
                { label: "Don't repeat", value: "" },
                { label: "Daily", value: "DAILY" },
                { label: "Weekly", value: "WEEKLY" },
                { label: "Monthly", value: "MONTHLY" },
                { label: "Yearly", value: "YEARLY" },
              ]}
            />
          </>
        ) : (
          <>
            <Alert color="blue" variant="light" icon={<IconMapPin size={16} />} p="xs">
              <Text size="xs">
                Location reminders fire on your phone via geofencing — they need the mobile app with
                location permission.
              </Text>
            </Alert>
            <TextInput
              label="Place name"
              placeholder="e.g. Home, Office"
              value={locationName}
              onChange={(e) => setLocationName(e.currentTarget.value)}
            />
            <Group grow>
              <NumberInput
                label="Latitude"
                value={lat}
                onChange={(v) => setLat(typeof v === "number" ? v : "")}
                decimalScale={6}
                step={0.0001}
              />
              <NumberInput
                label="Longitude"
                value={lng}
                onChange={(v) => setLng(typeof v === "number" ? v : "")}
                decimalScale={6}
                step={0.0001}
              />
            </Group>
            <NumberInput
              label="Radius (meters)"
              value={radiusM}
              onChange={(v) => setRadiusM(typeof v === "number" ? v : "")}
              min={50}
              step={100}
            />
            <Switch
              label="Notify when leaving (instead of arriving)"
              checked={onLeave}
              onChange={(e) => setOnLeave(e.currentTarget.checked)}
            />
          </>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting ?? false}
            disabled={trigger === "LOCATION" && !locationValid}
          >
            Create reminder
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
