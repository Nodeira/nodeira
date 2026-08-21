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
import { MarkdownConverterService } from "./markdown-converter.service.js";
import { NotesService } from "./notes.service.js";
import { DocumentBridge } from "../sync/document-bridge.service.js";

let prisma: PrismaClient;
let service: NotesService;
let owner: TestOwner;

beforeAll(async () => {
  prisma = createTestPrisma();
  await prisma.$connect();
  // An unregistered bridge reports "no sync server", which is what a standalone service
  // should see — setContent then falls back to writing the row directly.
  service = new NotesService(
    asPrismaService(prisma),
    new MarkdownConverterService(),
    new DocumentBridge(),
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

describe("NotesService", () => {
  describe("create", () => {
    it("defaults title to Untitled and assigns position 0 when no notes exist", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId });
      expect(note.title).toBe("Untitled");
      expect(note.position).toBe(0);
      expect(note.type).toBe("note");
    });

    it("assigns next position when notes already exist in the same scope", async () => {
      await service.create(owner.userId, { vaultId: owner.vaultId });
      const second = await service.create(owner.userId, { vaultId: owner.vaultId });
      expect(second.position).toBe(1);
    });

    it("uses explicit position when provided", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId, position: 5 });
      expect(note.position).toBe(5);
    });

    it("sets the provided title", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId, title: "My note" });
      expect(note.title).toBe("My note");
    });

    it("auto-position is scoped to folderId", async () => {
      // The previous version of this test created both notes in the same null-folder scope
      // and asserted position 1 — a duplicate of the test above that proved nothing about
      // folders. A note in a fresh folder must restart at position 0.
      await service.create(owner.userId, { vaultId: owner.vaultId });
      const folder = await prisma.folder.create({
        data: { name: "Folder", vaultId: owner.vaultId },
      });
      const folderNote = await service.create(owner.userId, {
        vaultId: owner.vaultId,
        folderId: folder.id,
      });
      expect(folderNote.position).toBe(0);
    });
  });

  describe("findAll", () => {
    it("returns all notes ordered by position", async () => {
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "B" });
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "A" });
      const notes = await service.findAll(owner.userId);
      expect(notes).toHaveLength(2);
      expect(notes[0]?.position).toBeLessThanOrEqual(notes[1]?.position ?? Infinity);
    });

    it("filters by vaultId when provided", async () => {
      const second = await prisma.vault.create({
        data: {
          name: "V2",
          ownerId: owner.userId,
          members: { create: { userId: owner.userId, role: "OWNER" } },
        },
      });
      await service.create(owner.userId, { vaultId: second.id, title: "In second" });
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "In first" });
      const result = await service.findAll(owner.userId, second.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("In second");
    });

    it("never returns notes from a vault the caller is not a member of", async () => {
      const other = await createOwnerWithVault(prisma);
      await service.create(other.userId, { vaultId: other.vaultId, title: "Theirs" });
      await service.create(owner.userId, { vaultId: owner.vaultId, title: "Mine" });

      const mine = await service.findAll(owner.userId);
      expect(mine.map((n) => n.title)).toEqual(["Mine"]);
    });

    it("returns empty array when no notes exist", async () => {
      const notes = await service.findAll(owner.userId);
      expect(notes).toHaveLength(0);
    });
  });

  describe("findOne", () => {
    it("returns the note by id", async () => {
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

    it("hides a note in another user's vault behind NotFound", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirs = await service.create(other.userId, {
        vaultId: other.vaultId,
        title: "Secret",
      });
      // NotFound rather than Forbidden: whether that note exists is itself information.
      await expect(service.findOne(owner.userId, theirs.id)).rejects.toThrow(NotFoundException);
    });

    it("allows a shared-vault member to read", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirs = await service.create(other.userId, {
        vaultId: other.vaultId,
        title: "Shared",
      });
      await prisma.vaultMember.create({
        data: { vaultId: other.vaultId, userId: owner.userId, role: "VIEWER" },
      });
      const found = await service.findOne(owner.userId, theirs.id);
      expect(found.title).toBe("Shared");
    });

    it("refuses writes from a VIEWER", async () => {
      const other = await createOwnerWithVault(prisma);
      const theirs = await service.create(other.userId, { vaultId: other.vaultId, title: "RO" });
      await prisma.vaultMember.create({
        data: { vaultId: other.vaultId, userId: owner.userId, role: "VIEWER" },
      });
      await expect(service.update(owner.userId, theirs.id, { title: "hacked" })).rejects.toThrow(
        /EDITOR/,
      );
    });
  });

  describe("update", () => {
    it("updates note fields", async () => {
      const note = await service.create(owner.userId, {
        vaultId: owner.vaultId,
        title: "Original",
      });
      const updated = await service.update(owner.userId, note.id, {
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
  });

  describe("reorder", () => {
    it("updates positions for multiple notes", async () => {
      const a = await service.create(owner.userId, { vaultId: owner.vaultId, title: "A" });
      const b = await service.create(owner.userId, { vaultId: owner.vaultId, title: "B" });
      await service.reorder(owner.userId, [
        { id: a.id, position: 10 },
        { id: b.id, position: 20 },
      ]);
      const notes = await service.findAll(owner.userId);
      const aRecord = notes.find((n) => n.id === a.id);
      const bRecord = notes.find((n) => n.id === b.id);
      expect(aRecord?.position).toBe(10);
      expect(bRecord?.position).toBe(20);
    });

    it("moves a note into a folder", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId, title: "Note" });
      const folder = await prisma.folder.create({
        data: { name: "Folder", vaultId: owner.vaultId },
      });
      await service.reorder(owner.userId, [{ id: note.id, position: 0, folderId: folder.id }]);
      const updated = await service.findOne(owner.userId, note.id);
      expect(updated.folderId).toBe(folder.id);
    });
  });

  describe("findOne", () => {
    it("treats a trashed note as not found", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId });
      await prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } });
      await expect(service.findOne(owner.userId, note.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateYjsState", () => {
    it("does not resurrect a note that does not exist", async () => {
      const id = "00000000-0000-0000-0000-000000000001";
      const state = new Uint8Array([1, 2, 3, 4]);
      await service.updateYjsState(id, state);
      await expect(service.findOne(owner.userId, id)).rejects.toThrow(NotFoundException);
    });

    it("reports 0 rows written for a missing note so the caller can log the dropped flush", async () => {
      const state = new Uint8Array([1, 2, 3, 4]);
      await expect(
        service.updateYjsState("00000000-0000-0000-0000-000000000002", state),
      ).resolves.toBe(0);
    });

    it("updates yjsState on an existing note", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId, title: "My note" });
      const state = new Uint8Array([5, 6, 7, 8]);
      await expect(service.updateYjsState(note.id, state)).resolves.toBe(1);
      const updated = await service.findOne(owner.userId, note.id);
      expect(updated.yjsState).toEqual(state);
    });

    it("reports 0 rows written for a trashed note, so a stale open connection cannot overwrite trashed content", async () => {
      const note = await service.create(owner.userId, { vaultId: owner.vaultId, title: "My note" });
      await prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } });
      const state = new Uint8Array([9, 9, 9, 9]);
      await expect(service.updateYjsState(note.id, state)).resolves.toBe(0);
      const stillTrashed = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
      expect(stillTrashed.yjsState).toBeNull();
    });
  });
});
