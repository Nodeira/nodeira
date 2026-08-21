import { Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import { useDesktopAutoUpdate } from "../../lib/useDesktopAutoUpdate.js";

/** Discord-style update prompt: peek at the version, let the user opt in, then restart to finish. */
export function UpdateAvailableModal() {
  const { state, upgrade, restart, dismiss } = useDesktopAutoUpdate();

  if (state.status === "idle") return null;

  const title =
    state.status === "available"
      ? "Update available"
      : state.status === "downloading"
        ? "Downloading update"
        : state.status === "downloaded"
          ? "Update ready"
          : "Update failed";

  return (
    <Modal opened onClose={dismiss} title={title} size="sm">
      <Stack>
        {state.status === "available" && (
          <>
            <Text size="sm">
              {state.info.version ? `Version ${state.info.version} is` : "A new version is"}{" "}
              available.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={dismiss}>
                Later
              </Button>
              <Button onClick={upgrade}>Upgrade</Button>
            </Group>
          </>
        )}

        {state.status === "downloading" && (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm">Downloading the update…</Text>
          </Group>
        )}

        {state.status === "downloaded" && (
          <>
            <Text size="sm">
              {state.info.version ? `Version ${state.info.version} is` : "The update is"} ready.
              Restart to finish updating.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={dismiss}>
                Later
              </Button>
              <Button onClick={restart}>Restart Now</Button>
            </Group>
          </>
        )}

        {state.status === "error" && (
          <>
            <Text size="sm" c="red">
              {state.message}
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={dismiss}>
                Dismiss
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
