import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Box,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useSetAtom } from "jotai";
import { createAdmin } from "../lib/api.js";
import { authStorage } from "../lib/authStorage.js";
import { authUserAtom } from "../store/atoms.js";
import { markSetupComplete } from "./__root.js";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const router = useRouter();
  const setAuthUser = useSetAtom(authUserAtom);

  const [active, setActive] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateAccount(): string | null {
    if (!email) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  }

  function handleNext() {
    if (active === 0) {
      const err = validateAccount();
      if (err) {
        setError(err);
        return;
      }
      setError("");
    }
    setActive((a) => a + 1);
  }

  async function handleFinish() {
    setError("");
    setLoading(true);
    try {
      const result = await createAdmin({ email, password, ...(name ? { name } : {}) });
      authStorage.setToken(result.access_token);
      authStorage.setUser(result.user);
      setAuthUser(result.user);
      markSetupComplete();
      await router.navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setActive(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Center h="100vh">
      <Box w={500}>
        <Title order={2} ta="center" mb="xs">
          Nodeira Setup
        </Title>
        <Text c="dimmed" ta="center" size="sm" mb="xl">
          Let&apos;s get you set up in just a moment
        </Text>

        <Paper withBorder shadow="md" p="xl" radius="md">
          <Stepper active={active} mb="xl">
            <Stepper.Step label="Admin account" description="Create your account">
              <Box mt="md">
                <TextInput
                  label="Name (optional)"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  mb="md"
                />
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
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  required
                  mb="md"
                />
                <PasswordInput
                  label="Confirm password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  required
                  mb="md"
                />
                {error && (
                  <Text c="red" size="sm" mb="md">
                    {error}
                  </Text>
                )}
              </Box>
            </Stepper.Step>

            <Stepper.Step label="Confirm" description="Review and finish">
              <Box mt="md">
                <Text mb="xs">
                  <strong>Name:</strong> {name || "(not set)"}
                </Text>
                <Text mb="xs">
                  <strong>Email:</strong> {email}
                </Text>
                <Text c="dimmed" size="sm" mt="md">
                  Your admin account will be created and you&apos;ll be signed in automatically.
                </Text>
                {error && (
                  <Text c="red" size="sm" mt="md">
                    {error}
                  </Text>
                )}
              </Box>
            </Stepper.Step>

            <Stepper.Completed>
              <Text ta="center" mt="md">
                Setup complete! Redirecting…
              </Text>
            </Stepper.Completed>
          </Stepper>

          <Group justify="flex-end">
            {active > 0 && active < 2 && (
              <Button variant="default" onClick={() => setActive((a) => a - 1)}>
                Back
              </Button>
            )}
            {active === 0 && <Button onClick={handleNext}>Next</Button>}
            {active === 1 && (
              <Button onClick={() => void handleFinish()} loading={loading}>
                Create account
              </Button>
            )}
          </Group>
        </Paper>
      </Box>
    </Center>
  );
}
