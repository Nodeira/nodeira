import { BadRequestException, NotFoundException } from "@nestjs/common";
import { VaultRole, type PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import {
  asPrismaService,
  cleanDatabase,
  createOwnerWithVault,
  createTestPrisma,
} from "../test/prisma-test-client.js";
import { VaultAccessService } from "./vault-access.service.js";
import { VaultsService } from "./vaults.service.js";

let prisma: PrismaClient;
let service: VaultsService;
let access: VaultAccessService;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  access = new VaultAccessService(asPrismaService(prisma));
  service = new VaultsService(asPrismaService(prisma), access);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe("VaultsService", () => {
  describe("create", () => {
    it("creates a vault owned by the caller with an OWNER membership", async () => {
      const { userId } = await createOwnerWithVault(prisma);
      const vault = await service.create(userId, { name: "Second" });

      expect(vault.ownerId).toBe(userId);
      const member = await prisma.vaultMember.findUnique({
        where: { vaultId_userId: { vaultId: vault.id, userId } },
      });
      expect(member?.role).toBe(VaultRole.OWNER);
    });
  });

  describe("findAll", () => {
    it("returns only vaults the caller is a member of", async () => {
      const alice = await createOwnerWithVault(prisma);
      const bob = await createOwnerWithVault(prisma);

      const forAlice = await service.findAll(alice.userId);
      expect(forAlice.map((v) => v.id)).toEqual([alice.vaultId]);

      const forBob = await service.findAll(bob.userId);
      expect(forBob.map((v) => v.id)).toEqual([bob.vaultId]);
    });

    it("includes a vault shared with the caller", async () => {
      const alice = await createOwnerWithVault(prisma);
      const bob = await createOwnerWithVault(prisma);

      await service.addMember(alice.userId, alice.vaultId, bob.userId, VaultRole.EDITOR);

      const forBob = await service.findAll(bob.userId);
      expect(forBob.map((v) => v.id).sort()).toEqual([alice.vaultId, bob.vaultId].sort());
    });
  });

  describe("sharing", () => {
    it("refuses to share a vault the caller does not own", async () => {
      const alice = await createOwnerWithVault(prisma);
      const bob = await createOwnerWithVault(prisma);

      await expect(
        service.addMember(bob.userId, alice.vaultId, bob.userId, VaultRole.EDITOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuses to let an EDITOR re-share the vault", async () => {
      const alice = await createOwnerWithVault(prisma);
      const bob = await createOwnerWithVault(prisma);
      const carol = await createOwnerWithVault(prisma);

      await service.addMember(alice.userId, alice.vaultId, bob.userId, VaultRole.EDITOR);

      await expect(
        service.addMember(bob.userId, alice.vaultId, carol.userId, VaultRole.EDITOR),
      ).rejects.toThrow(/OWNER/);
    });

    it("refuses to remove the owner", async () => {
      const alice = await createOwnerWithVault(prisma);
      await expect(service.removeMember(alice.userId, alice.vaultId, alice.userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("revokes access when a member is removed", async () => {
      const alice = await createOwnerWithVault(prisma);
      const bob = await createOwnerWithVault(prisma);

      await service.addMember(alice.userId, alice.vaultId, bob.userId, VaultRole.EDITOR);
      await service.removeMember(alice.userId, alice.vaultId, bob.userId);

      const forBob = await service.findAll(bob.userId);
      expect(forBob.map((v) => v.id)).toEqual([bob.vaultId]);
    });
  });

  describe("remove", () => {
    it("refuses to delete a vault that still holds canvases", async () => {
      const { userId, vaultId } = await createOwnerWithVault(prisma);
      await prisma.canvas.create({ data: { title: "C", vaultId, position: 0 } });

      // Canvases were never counted before, so a vault holding only canvases could be
      // deleted — and the cascade would now take them with it.
      await expect(service.remove(userId, vaultId)).rejects.toThrow(BadRequestException);
    });

    it("deletes an empty vault", async () => {
      const { userId } = await createOwnerWithVault(prisma);
      const vault = await service.create(userId, { name: "Disposable" });
      await service.remove(userId, vault.id);
      expect(await prisma.vault.findUnique({ where: { id: vault.id } })).toBeNull();
    });

    it("hides a vault the caller cannot see behind NotFound", async () => {
      const alice = await createOwnerWithVault(prisma);
      const bob = await createOwnerWithVault(prisma);
      await expect(service.remove(bob.userId, alice.vaultId)).rejects.toThrow(NotFoundException);
    });
  });
});
