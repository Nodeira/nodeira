import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Box, Button, Center, Paper, Text, TextInput, Title } from "@mantine/core";

export const Route = createFileRoute("/connect")({
  component: ConnectPage,
});

function ConnectPage() {
  const [url, setUrl] = useState("http://localhost:3001");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Server URL is required");
      return;
    }
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError("Enter a valid URL starting with http:// or https://");
      return;
    }
    setError("");
    setLoading(true);
    // Saves to DB and reloads the window — loading state resolves on reload
    await window.electronAPI!.settings.setServerUrl(trimmed);
  }

  return (
    <Center h="100vh">
      <Box w={460}>
        <Title order={2} ta="center" mb="xs">
          Connect to Nodeira
        </Title>
        <Text c="dimmed" ta="center" size="sm" mb="xl">
          Enter the URL of your Nodeira server
        </Text>

        <Paper withBorder shadow="md" p="xl" radius="md">
          <TextInput
            label="Server URL"
            placeholder="http://localhost:3001"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConnect();
            }}
            error={error}
            mb="md"
            autoFocus
          />
          <Button fullWidth loading={loading} onClick={() => void handleConnect()}>
            Connect
          </Button>
        </Paper>
      </Box>
    </Center>
  );
}
