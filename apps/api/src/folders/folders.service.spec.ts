import { NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { asPrismaService, cleanDatabase, createTestPrisma } from "../test/prisma-test-client.js";
import { FoldersService } from "./folders.service.js";

let prisma: PrismaClient;
let service: FoldersService;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new FoldersService(asPrismaService(prisma));
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe("FoldersService", () => {
  describe("create", () => {
    it("creates a folder with the given name", async () => {
      const folder = await service.create({ name: "Projects" });
      expect(folder.name).toBe("Projects");
      expect(folder.id).toBeDefined();
    });

    it("creates a folder scoped to a vault", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      const folder = await service.create({ name: "Notes", vaultId: vault.id });
      expect(folder.vaultId).toBe(vault.id);
    });
  });

  describe("findAll", () => {
    it("returns folders ordered by name", async () => {
      await service.create({ name: "Zebra" });
      await service.create({ name: "Alpha" });
      const folders = await service.findAll();
      expect(folders).toHaveLength(2);
      expect(folders[0]?.name).toBe("Alpha");
      expect(folders[1]?.name).toBe("Zebra");
    });

    it("filters by vaultId when provided", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      await service.create({ name: "In vault", vaultId: vault.id });
      await service.create({ name: "No vault" });
      const result = await service.findAll(vault.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("In vault");
    });

    it("returns empty array when no folders exist", async () => {
      expect(await service.findAll()).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates folder icon", async () => {
      const folder = await service.create({ name: "Work" });
      const updated = await service.update(folder.id, { icon: "🏢" });
      expect(updated.icon).toBe("🏢");
    });

    it("clears folder icon when set to null", async () => {
      const folder = await service.create({ name: "Work" });
      await service.update(folder.id, { icon: "🏢" });
      const cleared = await service.update(folder.id, { icon: null });
      expect(cleared.icon).toBeNull();
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(
        service.update("00000000-0000-0000-0000-000000000000", { icon: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes a folder", async () => {
      const folder = await service.create({ name: "Temp" });
      await service.remove(folder.id);
      const all = await service.findAll();
      expect(all).toHaveLength(0);
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(service.remove("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
