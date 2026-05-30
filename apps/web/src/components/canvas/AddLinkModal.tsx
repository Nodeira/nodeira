import { Box, Button, Group, Image, Loader, Modal, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { fetchUrlPreview } from "../../lib/api.js";
import type { OgPreview } from "@nodeira/shared-types";

interface AddLinkModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (url: string, preview: OgPreview) => void;
}

export function AddLinkModal({ opened, onClose, onConfirm }: AddLinkModalProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<OgPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUrlPreview(url);
      setPreview(result);
    } catch {
      setError("Could not fetch preview for this URL");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onConfirm(url, preview);
    setUrl("");
    setPreview(null);
    onClose();
  };

  const handleClose = () => {
    setUrl("");
    setPreview(null);
    setError(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Web Link" size="md">
      <Group gap="xs" mb="sm">
        <TextInput
          placeholder="https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.currentTarget.value);
            setPreview(null);
          }}
          style={{ flex: 1 }}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") void handlePreview(); }}
        />
        <Button onClick={() => void handlePreview()} loading={loading} disabled={!url}>
          Preview
        </Button>
      </Group>

      {error && (
        <Text size="sm" c="red" mb="sm">
          {error}
        </Text>
      )}

      {preview && (
        <Box
          style={{
            border: "1px solid var(--mantine-color-gray-3)",
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {preview.image && (
            <Image src={preview.image} h={100} fit="cover" alt="" />
          )}
          <Box p="xs">
            <Group gap={6} mb={4}>
              {preview.favicon && (
                <img
                  src={preview.favicon}
                  alt=""
                  width={14}
                  height={14}
                  style={{ borderRadius: 2 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <Text size="sm" fw={600} lineClamp={1}>
                {preview.title ?? url}
              </Text>
            </Group>
            {preview.description && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {preview.description}
              </Text>
            )}
          </Box>
        </Box>
      )}

      {loading && (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      )}

      <Group justify="flex-end">
        <Button variant="subtle" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!preview}>
          Add to Canvas
        </Button>
      </Group>
    </Modal>
  );
}
