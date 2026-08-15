import { createFileRoute } from "@tanstack/react-router";
import { Box, Button, Center, Paper, Text, TextInput, Title } from "@mantine/core";
import { useServerUrlForm } from "../lib/useServerUrlForm.js";

export const Route = createFileRoute("/connect")({
  component: ConnectPage,
});

function ConnectPage() {
  const { url, setUrl, error, loading, save } = useServerUrlForm("http://localhost:3001");

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
              if (e.key === "Enter") void save();
            }}
            error={error}
            mb="md"
            autoFocus
          />
          <Button fullWidth loading={loading} onClick={() => void save()}>
            Connect
          </Button>
        </Paper>
      </Box>
    </Center>
  );
}
