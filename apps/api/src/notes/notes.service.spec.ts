import { NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { asPrismaService, cleanDatabase, createTestPrisma } from "../test/prisma-test-client.js";
import { MarkdownConverterService } from "./markdown-converter.service.js";
import { NotesService } from "./notes.service.js";

let prisma: PrismaClient;
let service: NotesService;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new NotesService(asPrismaService(prisma), new MarkdownConverterService());
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe("NotesService", () => {
  describe("create", () => {
    it("defaults title to Untitled and assigns position 0 when no notes exist", async () => {
      const note = await service.create({});
      expect(note.title).toBe("Untitled");
      expect(note.position).toBe(0);
      expect(note.type).toBe("note");
    });

    it("assigns next position when notes already exist in the same scope", async () => {
      await service.create({});
      const second = await service.create({});
      expect(second.position).toBe(1);
    });

    it("uses explicit position when provided", async () => {
      const note = await service.create({ position: 5 });
      expect(note.position).toBe(5);
    });

    it("sets the provided title", async () => {
      const note = await service.create({ title: "My note" });
      expect(note.title).toBe("My note");
    });

    it("auto-position is scoped to folderId", async () => {
      await service.create({});
      const folderNote = await service.create({});
      // both in null-folder scope — second gets position 1
      expect(folderNote.position).toBe(1);
    });
  });

  describe("findAll", () => {
    it("returns all notes ordered by position", async () => {
      await service.create({ title: "B" });
      await service.create({ title: "A" });
      const notes = await service.findAll();
      expect(notes).toHaveLength(2);
      expect(notes[0]?.position).toBeLessThanOrEqual(notes[1]?.position ?? Infinity);
    });

    it("filters by vaultId when provided", async () => {
      const vault = await prisma.vault.create({ data: { name: "V1" } });
      await service.create({ title: "In vault", vaultId: vault.id });
      await service.create({ title: "No vault" });
      const result = await service.findAll(vault.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("In vault");
    });

    it("returns empty array when no notes exist", async () => {
      const notes = await service.findAll();
      expect(notes).toHaveLength(0);
    });
  });

  describe("findOne", () => {
    it("returns the note by id", async () => {
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
  });

  describe("update", () => {
    it("updates note fields", async () => {
      const note = await service.create({ title: "Original" });
      const updated = await service.update(note.id, { title: "Updated", pinned: true });
      expect(updated.title).toBe("Updated");
      expect(updated.pinned).toBe(true);
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(
        service.update("00000000-0000-0000-0000-000000000000", { title: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("reorder", () => {
    it("updates positions for multiple notes", async () => {
      const a = await service.create({ title: "A" });
      const b = await service.create({ title: "B" });
      await service.reorder([
        { id: a.id, position: 10 },
        { id: b.id, position: 20 },
      ]);
      const notes = await service.findAll();
      const aRecord = notes.find((n) => n.id === a.id);
      const bRecord = notes.find((n) => n.id === b.id);
      expect(aRecord?.position).toBe(10);
      expect(bRecord?.position).toBe(20);
    });

    it("moves a note into a folder", async () => {
      const note = await service.create({ title: "Note" });
      const folder = await prisma.folder.create({ data: { name: "Folder" } });
      await service.reorder([{ id: note.id, position: 0, folderId: folder.id }]);
      const updated = await service.findOne(note.id);
      expect(updated.folderId).toBe(folder.id);
    });
  });

  describe("remove", () => {
    it("deletes a note by id", async () => {
      const note = await service.create({});
      await service.remove(note.id);
      await expect(service.findOne(note.id)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for unknown id", async () => {
      await expect(service.remove("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("upsertYjsState", () => {
    it("creates a note with yjsState when note does not exist", async () => {
      const id = "00000000-0000-0000-0000-000000000001";
      const state = new Uint8Array([1, 2, 3, 4]);
      await service.upsertYjsState(id, state);
      const note = await service.findOne(id);
      expect(note.yjsState).toEqual(state);
    });

    it("updates yjsState on an existing note", async () => {
      const note = await service.create({ title: "My note" });
      const state = new Uint8Array([5, 6, 7, 8]);
      await service.upsertYjsState(note.id, state);
      const updated = await service.findOne(note.id);
      expect(updated.yjsState).toEqual(state);
    });
  });
});
