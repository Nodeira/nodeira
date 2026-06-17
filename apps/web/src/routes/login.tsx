import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Box,
  Button,
  Center,
  Checkbox,
  Group,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useSetAtom } from "jotai";
import { login } from "../lib/api.js";
import { authStorage } from "../lib/authStorage.js";
import { authUserAtom } from "../store/atoms.js";
import { ServerIndicator } from "../components/ServerIndicator.js";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const setAuthUser = useSetAtom(authUserAtom);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password, rememberMe);
      authStorage.setToken(result.access_token);
      authStorage.setUser(result.user);
      setAuthUser(result.user);
      await router.navigate({ to: "/" });
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Center h="100vh">
      <Box w={400}>
        <Title order={2} ta="center" mb="xs">
          Nodeira
        </Title>
        <Text c="dimmed" ta="center" size="sm" mb="xl">
          Sign in to your account
        </Text>

        <Paper withBorder shadow="md" p="xl" radius="md">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              mb="md"
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              mb="md"
            />
            <Checkbox
              label="Remember me for 30 days"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.currentTarget.checked)}
              mb="md"
            />
            {error && (
              <Text c="red" size="sm" mb="md">
                {error}
              </Text>
            )}
            <Button type="submit" fullWidth loading={loading}>
              Sign in
            </Button>
          </form>
        </Paper>

        <Group justify="center" mt="lg">
          <ServerIndicator />
        </Group>
      </Box>
    </Center>
  );
}
