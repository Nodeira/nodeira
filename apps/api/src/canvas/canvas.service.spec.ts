import { ForbiddenException, NotFoundException } from "@nestjs/common";
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
import { CanvasService } from "./canvas.service.js";

let prisma: PrismaClient;
let service: CanvasService;
let owner: TestOwner;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new CanvasService(
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

describe("CanvasService", () => {
  describe("create", () => {
    it("defaults title to 'Untitled Canvas' and assigns position 0 when no canvases exist", async () => {
      const canvas = await service.create(owner.userId, { vaultId: owner.vaultId });
      expect(canvas.title).toBe("Untitled Canvas");
      expect(canvas.position).toBe(0);
    });

    it("assigns next position when canvases already exist", async () => {
      await service.create(owner.userId, { vaultId: owner.vaultId });
      const second = await service.create(owner.userId, { vaultId: owner.vaultId });
      expect(second.position).toBe(1);
    });

    it("sets the provided title", async () => {
      const canvas = await service.create(owner.userId, {
        vaultId: owner.vaultId,
        title: "My Canvas",
      });
      expect(canvas.title).toBe("My Canvas");
    });

    it("assigns the provided vaultId", async () => {
      const vault = await prisma.vault.create({
        data: {
          name: "V1",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      const canvas = await service.create(owner.userId, { vaultId: vault.id });
      expect(canvas.vaultId).toBe(vault.id);
    });

    it("throws ForbiddenException when vaultScope does not match vaultId", async () => {
      const vault = await prisma.vault.create({
        data: {
          name: "V1",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      const other = await prisma.vault.create({
        data: {
          name: "V2",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      await expect(service.create(owner.userId, { vaultId: vault.id }, other.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("findAll", () => {
    it("returns all canvases ordered by position", async () => {
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "B" });
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "A" });
      const all = await service.findAll(owner.userId);
      expect(all).toHaveLength(2);
      expect(all[0]?.position).toBeLessThanOrEqual(all[1]?.position ?? Infinity);
    });

    it("filters by vaultId when provided", async () => {
      const vault = await prisma.vault.create({
        data: {
          name: "V1",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      await service.create(owner.userId, { title: "In vault", vaultId: vault.id });
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "No vault" });
      const result = await service.findAll(owner.userId, vault.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("In vault");
    });

    it("filters by title search query", async () => {
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "Alpha canvas" });
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "Beta canvas" });
      const result = await service.findAll(owner.userId, undefined, undefined, "alpha");
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Alpha canvas");
    });

    it("returns empty array when no canvases exist", async () => {
      expect(await service.findAll(owner.userId)).toHaveLength(0);
    });
  });

  describe("findOne", () => {
    it("returns a canvas by id", async () => {
      const created = await service.create(owner.userId, {
        vaultId: owner.vaultId,
        title: "Find me",
      });
      const found = await service.findOne(owner.userId, created.id);
      expect(found.id).toBe(created.id);
      expect(found.title).toBe("Find me");
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(
        service.findOne(owner.userId, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when vaultScope does not match", async () => {
      const vault = await prisma.vault.create({
        data: {
          name: "V1",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      const other = await prisma.vault.create({
        data: {
          name: "V2",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      const canvas = await service.create(owner.userId, { vaultId: vault.id });
      await expect(service.findOne(owner.userId, canvas.id, other.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("update", () => {
    it("updates canvas fields", async () => {
      const canvas = await service.create(owner.userId, {
        vaultId: owner.vaultId,
        title: "Original",
      });
      const updated = await service.update(owner.userId, canvas.id, {
        title: "Updated",
        pinned: true,
      });
      expect(updated.title).toBe("Updated");
      expect(updated.pinned).toBe(true);
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(
        service.update(owner.userId, "00000000-0000-0000-0000-000000000000", { title: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("moves a canvas into a folder in the same vault", async () => {
      const canvas = await service.create(owner.userId, { vaultId: owner.vaultId });
      const folder = await prisma.folder.create({
        data: { name: "Folder", vaultId: owner.vaultId },
      });
      const updated = await service.update(owner.userId, canvas.id, { folderId: folder.id });
      expect(updated.folderId).toBe(folder.id);
    });

    it("clears folderId when moved back to null", async () => {
      const folder = await prisma.folder.create({
        data: { name: "Folder", vaultId: owner.vaultId },
      });
      const canvas = await service.create(owner.userId, {
        vaultId: owner.vaultId,
        folderId: folder.id,
      });
      const updated = await service.update(owner.userId, canvas.id, { folderId: null });
      expect(updated.folderId).toBeNull();
    });

    it("throws NotFoundException when the folder belongs to a different vault", async () => {
      const canvas = await service.create(owner.userId, { vaultId: owner.vaultId });
      const otherVault = await prisma.vault.create({
        data: {
          name: "Other",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      const foreignFolder = await prisma.folder.create({
        data: { name: "Foreign", vaultId: otherVault.id },
      });
      await expect(
        service.update(owner.userId, canvas.id, { folderId: foreignFolder.id }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOne", () => {
    it("treats a trashed canvas as not found", async () => {
      const canvas = await service.create(owner.userId, { vaultId: owner.vaultId });
      await prisma.canvas.update({ where: { id: canvas.id }, data: { deletedAt: new Date() } });
      await expect(service.findOne(owner.userId, canvas.id)).rejects.toThrow(NotFoundException);
    });
  });
});
