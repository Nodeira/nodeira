import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { asPrismaService, cleanDatabase, createTestPrisma } from "../test/prisma-test-client.js";
import { CanvasService } from "./canvas.service.js";

let prisma: PrismaClient;
let service: CanvasService;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new CanvasService(asPrismaService(prisma));
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe("CanvasService", () => {
  describe("create", () => {
    it("defaults title to 'Untitled Canvas' and assigns position 0 when no canvases exist", async () => {
      const canvas = await service.create({});
      expect(canvas.title).toBe("Untitled Canvas");
      expect(canvas.position).toBe(0);
    });

    it("assigns next position when canvases already exist", async () => {
      await service.create({});
      const second = await service.create({});
      expect(second.position).toBe(1);
    });

    it("sets the provided title", async () => {
      const canvas = await service.create({ title: "My Canvas" });
      expect(canvas.title).toBe("My Canvas");
    });

    it("assigns the provided vaultId", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      const canvas = await service.create({ vaultId: vault.id });
      expect(canvas.vaultId).toBe(vault.id);
    });

    it("throws ForbiddenException when vaultScope does not match vaultId", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      const other = await prisma.vault.create({ data: { name: "V2" } });
      await expect(service.create({ vaultId: vault.id }, other.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("findAll", () => {
    it("returns all canvases ordered by position", async () => {
      await service.create({ title: "B" });
      await service.create({ title: "A" });
      const all = await service.findAll();
      expect(all).toHaveLength(2);
      expect(all[0]?.position).toBeLessThanOrEqual(all[1]?.position ?? Infinity);
    });

    it("filters by vaultId when provided", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      await service.create({ title: "In vault", vaultId: vault.id });
      await service.create({ title: "No vault" });
      const result = await service.findAll(vault.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("In vault");
    });

    it("filters by title search query", async () => {
      await service.create({ title: "Alpha canvas" });
      await service.create({ title: "Beta canvas" });
      const result = await service.findAll(undefined, undefined, "alpha");
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Alpha canvas");
    });

    it("returns empty array when no canvases exist", async () => {
      expect(await service.findAll()).toHaveLength(0);
    });
  });

  describe("findOne", () => {
    it("returns a canvas by id", async () => {
      const created = await service.create({ title: "Find me" });
      const found = await service.findOne(created.id);
      expect(found.id).toBe(created.id);
      expect(found.title).toBe("Find me");
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(service.findOne("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when vaultScope does not match", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      const other = await prisma.vault.create({ data: { name: "V2" } });
      const canvas = await service.create({ vaultId: vault.id });
      await expect(service.findOne(canvas.id, other.id)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("update", () => {
    it("updates canvas fields", async () => {
      const canvas = await service.create({ title: "Original" });
      const updated = await service.update(canvas.id, { title: "Updated", pinned: true });
      expect(updated.title).toBe("Updated");
      expect(updated.pinned).toBe(true);
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(
        service.update("00000000-0000-0000-0000-000000000000", { title: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes a canvas by id", async () => {
      const canvas = await service.create({});
      await service.remove(canvas.id);
      await expect(service.findOne(canvas.id)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(service.remove("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
