import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
import { PrismaClient, Role, VaultRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaService } from "../database/prisma.service.js";

export function createTestPrisma(): PrismaClient {
  const databaseUrl = inject("databaseUrl");
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function asPrismaService(client: PrismaClient): PrismaService {
  return client as unknown as PrismaService;
}

/**
 * Truncates every table.
 *
 * This used to clear only note/canvas/folder/vault, leaking users, api_tokens, plugins,
 * reminders, devices and app_state between tests — a latent cross-test-pollution bug that
 * `pool: "forks", singleFork: true` made certain to bite the moment anyone wrote an auth
 * test. Order matters only where cascades do not cover it, so users go last.
 */
export async function cleanDatabase(prisma: PrismaClient) {
  await prisma.noteLink.deleteMany();
  await prisma.note.deleteMany();
  await prisma.canvas.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.vaultMember.deleteMany();
  await prisma.vault.deleteMany();
  await prisma.appState.deleteMany();
  await prisma.apiToken.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.device.deleteMany();
  await prisma.plugin.deleteMany();
  await prisma.user.deleteMany();
}

export interface TestOwner {
  userId: string;
  vaultId: string;
}

/**
 * Creates a user who owns one vault — the minimum needed to own any content now that
 * notes, folders and canvases all require a vault and access is decided by membership.
 */
export async function createOwnerWithVault(
  prisma: PrismaClient,
  email = `user-${crypto.randomUUID()}@example.com`,
): Promise<TestOwner> {
  const user = await prisma.user.create({
    data: { email, password: "hashed", role: Role.ADMIN },
  });
  const vault = await prisma.vault.create({
    data: {
      name: "Main vault",
      ownerId: user.id,
      members: { create: { userId: user.id, role: VaultRole.OWNER } },
    },
  });
  return { userId: user.id, vaultId: vault.id };
}
