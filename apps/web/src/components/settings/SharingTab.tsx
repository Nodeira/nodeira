import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconTrash, IconUserPlus } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VaultRole } from "@nodeira/shared-types";
import {
  addVaultMember,
  createUser,
  getUsers,
  getVaultMembers,
  getVaults,
  removeVaultMember,
  usersKeys,
  vaultMembersKeys,
  vaultsKeys,
} from "../../lib/api.js";
import { authUserAtom } from "../../store/atoms.js";

const VAULT_ROLES: { value: VaultRole; label: string; hint: string }[] = [
  { value: "VIEWER", label: "Viewer", hint: "Can read notes in this vault" },
  { value: "EDITOR", label: "Editor", hint: "Can read and write" },
  { value: "OWNER", label: "Owner", hint: "Can also share and delete the vault" },
];

/**
 * Vault sharing and (for admins) user management.
 *
 * Vault membership is what grants access to notes, folders and canvases — the endpoints
 * behind this panel shipped with multi-user, but nothing drove them, so sharing was
 * API-only. Only a vault's OWNER may change its membership; the server enforces that
 * regardless of what this UI offers.
 */
export function SharingTab() {
  const qc = useQueryClient();
  const authUser = useAtomValue(authUserAtom);
  const isAdmin = authUser?.role === "ADMIN";

  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<VaultRole>("EDITOR");
  const [newUserOpen, { open: openNewUser, close: closeNewUser }] = useDisclosure(false);

  const { data: vaults = [] } = useQuery({ queryKey: vaultsKeys.all, queryFn: getVaults });
  const { data: users = [] } = useQuery({ queryKey: usersKeys.all, queryFn: getUsers });

  const vaultId = selectedVaultId ?? vaults[0]?.id ?? null;

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: vaultMembersKeys.forVault(vaultId ?? ""),
    queryFn: () => getVaultMembers(vaultId!),
    enabled: vaultId !== null,
  });

  const invalidateMembers = () => {
    if (vaultId) void qc.invalidateQueries({ queryKey: vaultMembersKeys.forVault(vaultId) });
    // Sharing changes what the other user can see, and their own vault list.
    void qc.invalidateQueries({ queryKey: vaultsKeys.all });
  };

  const addMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: VaultRole }) =>
      addVaultMember(vaultId!, userId, role),
    onSuccess: () => {
      invalidateMembers();
      setInviteUserId(null);
      notifications.show({ message: "Vault shared", color: "blue" });
    },
    onError: (err: Error) =>
      notifications.show({ message: err.message || "Couldn't share vault", color: "red" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeVaultMember(vaultId!, userId),
    onSuccess: () => {
      invalidateMembers();
      notifications.show({ message: "Access revoked", color: "blue" });
    },
    onError: (err: Error) =>
      notifications.show({ message: err.message || "Couldn't revoke access", color: "red" }),
  });

  const memberIds = new Set(members.map((m) => m.user.id));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  return (
    <Stack gap="lg">
      <Card withBorder padding="md">
        <Stack gap="sm">
          <div>
            <Title order={5}>Vault sharing</Title>
            <Text size="sm" c="dimmed">
              Members can reach every note, folder and canvas in the vault.
            </Text>
          </div>

          <Select
            label="Vault"
            data={vaults.map((v) => ({ value: v.id, label: v.name }))}
            value={vaultId}
            onChange={setSelectedVaultId}
            allowDeselect={false}
            disabled={vaults.length === 0}
          />

          {vaultId && (
            <>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Access</Table.Th>
                    <Table.Th w={60} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {membersLoading && (
                    <Table.Tr>
                      <Table.Td colSpan={3}>
                        <Text size="sm" c="dimmed">
                          Loading…
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {members.map((m) => (
                    <Table.Tr key={m.user.id}>
                      <Table.Td>
                        <Text size="sm">{m.user.name ?? m.user.email}</Text>
                        {m.user.name && (
                          <Text size="xs" c="dimmed">
                            {m.user.email}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={m.role === "OWNER" ? "indigo" : "gray"}
                        >
                          {m.role.toLowerCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {/* The server refuses to remove the owner — a vault with none would
                            leave nobody able to re-share it. */}
                        {m.role !== "OWNER" && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Remove ${m.user.email}`}
                            onClick={() => removeMemberMutation.mutate(m.user.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group align="flex-end" gap="sm">
                <Select
                  label="Add someone"
                  placeholder={candidates.length ? "Select a user" : "Everyone already has access"}
                  data={candidates.map((u) => ({ value: u.id, label: u.name ?? u.email }))}
                  value={inviteUserId}
                  onChange={setInviteUserId}
                  disabled={candidates.length === 0}
                  searchable
                  style={{ flex: 1 }}
                />
                <Select
                  label="Access"
                  data={VAULT_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                  value={inviteRole}
                  onChange={(v) => v && setInviteRole(v as VaultRole)}
                  allowDeselect={false}
                  w={140}
                />
                <Button
                  disabled={!inviteUserId}
                  loading={addMemberMutation.isPending}
                  onClick={() =>
                    inviteUserId &&
                    addMemberMutation.mutate({ userId: inviteUserId, role: inviteRole })
                  }
                >
                  Share
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                {VAULT_ROLES.find((r) => r.value === inviteRole)?.hint}
              </Text>
            </>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={5}>Users</Title>
              <Text size="sm" c="dimmed">
                Accounts on this instance. There is no public sign-up — an admin creates them.
              </Text>
            </div>
            {isAdmin && (
              <Button leftSection={<IconUserPlus size={16} />} onClick={openNewUser}>
                New user
              </Button>
            )}
          </Group>

          {!isAdmin && (
            <Alert variant="light" color="gray">
              Only an admin can create accounts.
            </Alert>
          )}

          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th w={100}>Role</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>
                    <Text size="sm">{u.name ?? u.email}</Text>
                    {u.name && (
                      <Text size="xs" c="dimmed">
                        {u.email}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={u.role === "ADMIN" ? "indigo" : "gray"}>
                      {u.role.toLowerCase()}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>

      <NewUserModal opened={newUserOpen} onClose={closeNewUser} />
    </Stack>
  );
}

function NewUserModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const reset = () => {
    setEmail("");
    setName("");
    setPassword("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      createUser({ email: email.trim(), password, ...(name.trim() ? { name: name.trim() } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: usersKeys.all });
      notifications.show({ message: "User created", color: "blue" });
      reset();
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ message: err.message || "Couldn't create user", color: "red" }),
  });

  // Matches the server's MinLength(8) so the failure shows before the round trip.
  const valid = email.includes("@") && password.length >= 8;

  return (
    <Modal opened={opened} onClose={onClose} title="New user" size="sm">
      <Stack>
        <TextInput
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          autoFocus
        />
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <PasswordInput
          label="Password"
          description="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
