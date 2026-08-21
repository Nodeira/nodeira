import { NotFoundException } from "@nestjs/common";
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
import { TrashService } from "./trash.service.js";

let prisma: PrismaClient;
let service: TrashService;
let owner: TestOwner;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  service = new TrashService(
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

/** Builds folder A > folder B > folder C, with a note and canvas hanging off each level. */
async function buildNestedTree(vaultId: string) {
  const a = await prisma.folder.create({ data: { name: "A", vaultId } });
  const b = await prisma.folder.create({ data: { name: "B", vaultId, parentId: a.id } });
  const c = await prisma.folder.create({ data: { name: "C", vaultId, parentId: b.id } });

  const noteA = await prisma.note.create({ data: { vaultId, folderId: a.id, title: "note-a" } });
  const noteB = await prisma.note.create({ data: { vaultId, folderId: b.id, title: "note-b" } });
  const noteC = await prisma.note.create({ data: { vaultId, folderId: c.id, title: "note-c" } });
  const canvasB = await prisma.canvas.create({
    data: { vaultId, folderId: b.id, title: "canvas-b" },
  });

  const rootNote = await prisma.note.create({ data: { vaultId, title: "root-note" } });

  return { a, b, c, noteA, noteB, noteC, canvasB, rootNote };
}

describe("TrashService", () => {
  describe("trashNote / restoreNote / purgeNote", () => {
    it("trashes, restores, and purges a single note", async () => {
      const note = await prisma.note.create({ data: { vaultId: owner.vaultId, title: "n" } });

      await service.trashNote(owner.userId, note.id);
      expect(
        (await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).deletedAt,
      ).not.toBeNull();

      await service.restoreNote(owner.userId, note.id);
      expect(
        (await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).deletedAt,
      ).toBeNull();

      await service.trashNote(owner.userId, note.id);
      await service.purgeNote(owner.userId, note.id);
      expect(await prisma.note.findUnique({ where: { id: note.id } })).toBeNull();
    });

    it("refuses to trash a note in another user's vault", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirs = await prisma.note.create({ data: { vaultId: other.vaultId, title: "n" } });
      await expect(service.trashNote(owner.userId, theirs.id)).rejects.toThrow(NotFoundException);
    });

    it("refuses to restore a note that isn't trashed", async () => {
      const note = await prisma.note.create({ data: { vaultId: owner.vaultId, title: "n" } });
      await expect(service.restoreNote(owner.userId, note.id)).rejects.toThrow(NotFoundException);
    });

    it("refuses to trash a note that is already trashed", async () => {
      const note = await prisma.note.create({ data: { vaultId: owner.vaultId, title: "n" } });
      await service.trashNote(owner.userId, note.id);
      await expect(service.trashNote(owner.userId, note.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("trashFolder", () => {
    it("cascades to every descendant folder, note, and canvas", async () => {
      const { a, b, c, noteA, noteB, noteC, canvasB, rootNote } = await buildNestedTree(
        owner.vaultId,
      );

      const result = await service.trashFolder(owner.userId, a.id);
      expect(result.folderCount).toBe(3);
      expect(result.noteCount).toBe(3);
      expect(result.canvasCount).toBe(1);

      for (const folder of [a, b, c]) {
        expect(
          (await prisma.folder.findUniqueOrThrow({ where: { id: folder.id } })).deletedAt,
        ).not.toBeNull();
      }
      for (const note of [noteA, noteB, noteC]) {
        expect(
          (await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).deletedAt,
        ).not.toBeNull();
      }
      expect(
        (await prisma.canvas.findUniqueOrThrow({ where: { id: canvasB.id } })).deletedAt,
      ).not.toBeNull();

      // Untouched: a note outside the trashed subtree.
      expect(
        (await prisma.note.findUniqueOrThrow({ where: { id: rootNote.id } })).deletedAt,
      ).toBeNull();
    });

    it("does not touch a sibling subtree", async () => {
      const { a } = await buildNestedTree(owner.vaultId);
      const sibling = await prisma.folder.create({
        data: { name: "sibling", vaultId: owner.vaultId },
      });
      const siblingNote = await prisma.note.create({
        data: { vaultId: owner.vaultId, folderId: sibling.id, title: "s" },
      });

      await service.trashFolder(owner.userId, a.id);

      expect(
        (await prisma.folder.findUniqueOrThrow({ where: { id: sibling.id } })).deletedAt,
      ).toBeNull();
      expect(
        (await prisma.note.findUniqueOrThrow({ where: { id: siblingNote.id } })).deletedAt,
      ).toBeNull();
    });
  });

  describe("restoreFolder", () => {
    it("restores the folder and every descendant that was cascaded with it", async () => {
      const { a, b, c, noteA, noteB, noteC, canvasB } = await buildNestedTree(owner.vaultId);
      await service.trashFolder(owner.userId, a.id);

      const result = await service.restoreFolder(owner.userId, a.id);
      expect(result.id).toBe(a.id);

      for (const folder of [a, b, c]) {
        expect(
          (await prisma.folder.findUniqueOrThrow({ where: { id: folder.id } })).deletedAt,
        ).toBeNull();
      }
      for (const note of [noteA, noteB, noteC]) {
        expect(
          (await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).deletedAt,
        ).toBeNull();
      }
      expect(
        (await prisma.canvas.findUniqueOrThrow({ where: { id: canvasB.id } })).deletedAt,
      ).toBeNull();
    });

    it("also restores a note trashed independently inside the subtree before the folder was trashed", async () => {
      const { a, noteA } = await buildNestedTree(owner.vaultId);
      // noteA is trashed on its own, at a different time than the folder.
      await service.trashNote(owner.userId, noteA.id);
      await service.trashFolder(owner.userId, a.id);

      await service.restoreFolder(owner.userId, a.id);

      expect(
        (await prisma.note.findUniqueOrThrow({ where: { id: noteA.id } })).deletedAt,
      ).toBeNull();
    });
  });

  describe("purgeFolder", () => {
    it("permanently deletes the folder and everything inside it, not just orphaning contents", async () => {
      const { a, b, c, noteA, noteB, noteC, canvasB } = await buildNestedTree(owner.vaultId);
      await service.trashFolder(owner.userId, a.id);

      await service.purgeFolder(owner.userId, a.id);

      for (const folder of [a, b, c]) {
        expect(await prisma.folder.findUnique({ where: { id: folder.id } })).toBeNull();
      }
      for (const note of [noteA, noteB, noteC]) {
        expect(await prisma.note.findUnique({ where: { id: note.id } })).toBeNull();
      }
      expect(await prisma.canvas.findUnique({ where: { id: canvasB.id } })).toBeNull();
    });

    it("refuses to purge a folder that isn't trashed", async () => {
      const folder = await prisma.folder.create({ data: { name: "live", vaultId: owner.vaultId } });
      await expect(service.purgeFolder(owner.userId, folder.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("shows only top-level trashed items, not descendants of a trashed folder", async () => {
      const { a } = await buildNestedTree(owner.vaultId);
      await service.trashFolder(owner.userId, a.id);

      const independentNote = await prisma.note.create({
        data: { vaultId: owner.vaultId, title: "solo" },
      });
      await service.trashNote(owner.userId, independentNote.id);

      const items = await service.list(owner.userId, owner.vaultId);

      expect(items).toHaveLength(2);
      const folderItem = items.find((i) => i.type === "folder");
      expect(folderItem?.id).toBe(a.id);
      // 2 descendant folders + 3 notes + 1 canvas = 6, per buildNestedTree's shape under A.
      expect(folderItem?.itemCount).toBe(6);
      expect(items.find((i) => i.type === "note")?.id).toBe(independentNote.id);
    });

    it("does not show items from a vault the caller cannot access", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirNote = await prisma.note.create({ data: { vaultId: other.vaultId, title: "n" } });
      await service.trashNote(other.userId, theirNote.id);

      const items = await service.list(owner.userId);
      expect(items).toHaveLength(0);
    });
  });

  describe("purgeExpired", () => {
    it("purges only items trashed before the cutoff", async () => {
      const old = await prisma.note.create({ data: { vaultId: owner.vaultId, title: "old" } });
      const recent = await prisma.note.create({
        data: { vaultId: owner.vaultId, title: "recent" },
      });

      await prisma.note.update({
        where: { id: old.id },
        data: { deletedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
      });
      await prisma.note.update({ where: { id: recent.id }, data: { deletedAt: new Date() } });

      const result = await service.purgeExpired(30 * 24 * 60 * 60 * 1000);

      expect(result.notes).toBe(1);
      expect(await prisma.note.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await prisma.note.findUnique({ where: { id: recent.id } })).not.toBeNull();
    });

    it("purges an expired folder's contents regardless of tree structure", async () => {
      const { a, b, c, noteA, noteB, noteC, canvasB } = await buildNestedTree(owner.vaultId);
      const oldCutoff = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await service.trashFolder(owner.userId, a.id);
      // Cascade always stamps "now" — backdate everything to simulate age.
      await prisma.folder.updateMany({
        where: { id: { in: [a.id, b.id, c.id] } },
        data: { deletedAt: oldCutoff },
      });
      await prisma.note.updateMany({
        where: { id: { in: [noteA.id, noteB.id, noteC.id] } },
        data: { deletedAt: oldCutoff },
      });
      await prisma.canvas.update({ where: { id: canvasB.id }, data: { deletedAt: oldCutoff } });

      const result = await service.purgeExpired(30 * 24 * 60 * 60 * 1000);

      expect(result.folders).toBe(3);
      expect(result.notes).toBe(3);
      expect(result.canvases).toBe(1);
      expect(await prisma.folder.findUnique({ where: { id: a.id } })).toBeNull();
    });
  });
});
