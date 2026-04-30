import type { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { asPrismaService, cleanDatabase, createTestPrisma } from "../test/prisma-test-client.js";
import { VaultsService } from "./vaults.service.js";

let prisma: PrismaClient;
let service: VaultsService;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new VaultsService(asPrismaService(prisma));
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe("VaultsService", () => {
  describe("onModuleInit (seed)", () => {
    it("creates a Main vault and migrates orphaned notes and folders when DB is empty", async () => {
      const orphanNote = await prisma.note.create({
        data: { title: "Orphan", type: "note", position: 0 },
      });
      const orphanFolder = await prisma.folder.create({ data: { name: "OldFolder" } });

      await service.onModuleInit();

      const vaults = await prisma.vault.findMany();
      expect(vaults).toHaveLength(1);
      expect(vaults[0]?.name).toBe("Main vault");

      const note = await prisma.note.findUnique({ where: { id: orphanNote.id } });
      expect(note?.vaultId).toBe(vaults[0]?.id);

      const folder = await prisma.folder.findUnique({ where: { id: orphanFolder.id } });
      expect(folder?.vaultId).toBe(vaults[0]?.id);
    });

    it("does not create a vault when one already exists", async () => {
      await prisma.vault.create({ data: { name: "Existing" } });
      await service.onModuleInit();
      const vaults = await prisma.vault.findMany();
      expect(vaults).toHaveLength(1);
      expect(vaults[0]?.name).toBe("Existing");
    });
  });

  describe("create", () => {
    it("creates a vault with the given name", async () => {
      const vault = await service.create({ name: "Work" });
      expect(vault.name).toBe("Work");
      expect(vault.id).toBeDefined();
    });
  });

  describe("findAll", () => {
    it("returns vaults ordered by createdAt ascending", async () => {
      const first = await service.create({ name: "First" });
      const second = await service.create({ name: "Second" });
      const all = await service.findAll();
      expect(all).toHaveLength(2);
      expect(all[0]?.id).toBe(first.id);
      expect(all[1]?.id).toBe(second.id);
    });

    it("returns empty array when no vaults exist", async () => {
      expect(await service.findAll()).toHaveLength(0);
    });
  });

  describe("remove", () => {
    it("deletes an empty vault", async () => {
      const vault = await service.create({ name: "Empty" });
      await service.remove(vault.id);
      const all = await service.findAll();
      expect(all).toHaveLength(0);
    });

    it("throws when vault contains notes", async () => {
      const vault = await service.create({ name: "Has notes" });
      await prisma.note.create({
        data: { title: "Note", type: "note", position: 0, vaultId: vault.id },
      });
      await expect(service.remove(vault.id)).rejects.toThrow(
        "Cannot delete a vault that contains notes or folders",
      );
    });

    it("throws when vault contains folders", async () => {
      const vault = await service.create({ name: "Has folders" });
      await prisma.folder.create({ data: { name: "Folder", vaultId: vault.id } });
      await expect(service.remove(vault.id)).rejects.toThrow(
        "Cannot delete a vault that contains notes or folders",
      );
    });

    it("throws NotFoundException for unknown id", async () => {
      const { NotFoundException } = await import("@nestjs/common");
      await expect(service.remove("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
