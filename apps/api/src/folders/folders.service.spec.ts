import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import {
  asPrismaService,
  cleanDatabase,
  createOwnerWithVault,
  createTestPrisma,
  type TestOwner,
} from "../test/prisma-test-client.js";
import { VaultAccessService } from "../vaults/vault-access.service.js";
import { FoldersService } from "./folders.service.js";

let prisma: PrismaClient;
let service: FoldersService;
let owner: TestOwner;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new FoldersService(
    asPrismaService(prisma),
    new VaultAccessService(asPrismaService(prisma)),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
  owner = await createOwnerWithVault(prisma);
});

describe("FoldersService", () => {
  describe("create", () => {
    it("creates a folder in the caller's vault", async () => {
      const folder = await service.create(owner.userId, {
        name: "Projects",
        vaultId: owner.vaultId,
      });
      expect(folder.name).toBe("Projects");
      expect(folder.vaultId).toBe(owner.vaultId);
    });

    it("refuses to create a folder in a vault the caller cannot reach", async () => {
      const other = await createOwnerWithVault(prisma);
      await expect(
        service.create(owner.userId, { name: "Sneaky", vaultId: other.vaultId }),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuses a parent folder from a different vault", async () => {
      const other = await createOwnerWithVault(prisma);
      const parent = await service.create(other.userId, { name: "Theirs", vaultId: other.vaultId });

      // Sharing the other vault makes the parent reachable, so the failure that remains is
      // specifically the cross-vault tree, not a permissions error.
      await prisma.vaultMember.create({
        data: { vaultId: other.vaultId, userId: owner.userId, role: "EDITOR" },
      });

      await expect(
        service.create(owner.userId, {
          name: "Child",
          vaultId: owner.vaultId,
          parentId: parent.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    it("returns folders ordered by name", async () => {
      await service.create(owner.userId, { name: "Zebra", vaultId: owner.vaultId });
      await service.create(owner.userId, { name: "Alpha", vaultId: owner.vaultId });
      const folders = await service.findAll(owner.userId);
      expect(folders.map((f) => f.name)).toEqual(["Alpha", "Zebra"]);
    });

    it("never returns folders from vaults the caller is not a member of", async () => {
      const other = await createOwnerWithVault(prisma);
      await service.create(other.userId, { name: "Theirs", vaultId: other.vaultId });
      await service.create(owner.userId, { name: "Mine", vaultId: owner.vaultId });

      const folders = await service.findAll(owner.userId);
      expect(folders.map((f) => f.name)).toEqual(["Mine"]);
    });

    it("returns an empty list when the caller has no vaults", async () => {
      const stranger = await prisma.user.create({
        data: { email: "nobody@example.com", password: "x" },
      });
      expect(await service.findAll(stranger.id)).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("sets the icon", async () => {
      const folder = await service.create(owner.userId, { name: "F", vaultId: owner.vaultId });
      const updated = await service.update(owner.userId, folder.id, { icon: "star" });
      expect(updated.icon).toBe("star");
    });

    it("refuses to touch a folder in another user's vault", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirs = await service.create(other.userId, { name: "T", vaultId: other.vaultId });
      await expect(service.update(owner.userId, theirs.id, { icon: "star" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(
        service.update(owner.userId, "00000000-0000-0000-0000-000000000000", { icon: null }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes a folder", async () => {
      const folder = await service.create(owner.userId, { name: "Temp", vaultId: owner.vaultId });
      await service.remove(owner.userId, folder.id);
      expect(await prisma.folder.findUnique({ where: { id: folder.id } })).toBeNull();
    });

    it("refuses to delete a folder in another user's vault", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirs = await service.create(other.userId, { name: "T", vaultId: other.vaultId });
      await expect(service.remove(owner.userId, theirs.id)).rejects.toThrow(NotFoundException);
    });
  });
});
