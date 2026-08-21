import { Injectable, NotFoundException } from "@nestjs/common";
import { VaultRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { orNotFound } from "../database/prisma-errors.js";
import { VaultAccessService } from "../vaults/vault-access.service.js";

export enum TrashItemTypeParam {
  note = "note",
  folder = "folder",
  canvas = "canvas",
}

export type TrashItemType = "note" | "folder" | "canvas";

export type TrashItemSummary = {
  type: TrashItemType;
  id: string;
  title: string;
  vaultId: string;
  deletedAt: Date;
  /** Notes/canvases/subfolders nested inside — folders only. */
  itemCount?: number;
};

type SubtreeIds = { folderIds: string[]; noteIds: string[]; canvasIds: string[] };

/**
 * Owns soft-delete (trash), restore, and permanent purge for Note/Folder/Canvas.
 *
 * Deliberately does not depend on NotesService/FoldersService/CanvasService — those
 * depend on this instead (via TrashModule), so there is no circular import. Does its own
 * tiny load-then-authorize per entity, mirroring the identical pattern already used in
 * NotesService.findOne and FoldersService.findAuthorized.
 */
@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VaultAccessService,
  ) {}

  // ── Folder subtree ───────────────────────────────────────────────────────

  /**
   * BFS over a folder's descendants. `trashed` selects which "layer" to walk: live rows
   * when trashing (nothing here should already be in trash), trashed rows when
   * restoring/purging (everything here was cascaded together, or the same items would
   * already have come back / been purged). vaultId is redundant with the FK chain but
   * kept as a defense-in-depth scope on every query.
   */
  private async collectFolderSubtreeIds(
    rootFolderId: string,
    vaultId: string,
    trashed: boolean,
  ): Promise<SubtreeIds> {
    const deletedAtFilter = trashed ? { not: null } : null;
    const folderIds = [rootFolderId];
    let frontier = [rootFolderId];
    while (frontier.length > 0) {
      const children = await this.prisma.folder.findMany({
        where: { parentId: { in: frontier }, vaultId, deletedAt: deletedAtFilter },
        select: { id: true },
      });
      frontier = children.map((c) => c.id);
      folderIds.push(...frontier);
    }

    const [notes, canvases] = await Promise.all([
      this.prisma.note.findMany({
        where: { folderId: { in: folderIds }, vaultId, deletedAt: deletedAtFilter },
        select: { id: true },
      }),
      this.prisma.canvas.findMany({
        where: { folderId: { in: folderIds }, vaultId, deletedAt: deletedAtFilter },
        select: { id: true },
      }),
    ]);

    return { folderIds, noteIds: notes.map((n) => n.id), canvasIds: canvases.map((c) => c.id) };
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  private async loadFolder(id: string, requireTrashed: boolean) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || Boolean(folder.deletedAt) !== requireTrashed) {
      throw new NotFoundException(`Folder ${id} not found`);
    }
    return folder;
  }

  private async loadNote(id: string, requireTrashed: boolean) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note || Boolean(note.deletedAt) !== requireTrashed) {
      throw new NotFoundException(`Note ${id} not found`);
    }
    return note;
  }

  private async loadCanvas(id: string, requireTrashed: boolean) {
    const canvas = await this.prisma.canvas.findUnique({ where: { id } });
    if (!canvas || Boolean(canvas.deletedAt) !== requireTrashed) {
      throw new NotFoundException(`Canvas ${id} not found`);
    }
    return canvas;
  }

  // ── Trash ─────────────────────────────────────────────────────────────────

  async trashNote(userId: string, id: string, vaultScope?: string | null) {
    const note = await this.loadNote(id, false);
    await this.access.assertAccessToVaultOf(userId, note, VaultRole.EDITOR, vaultScope);
    return orNotFound(
      this.prisma.note.update({ where: { id }, data: { deletedAt: new Date() } }),
      `Note ${id} not found`,
    );
  }

  async trashCanvas(userId: string, id: string, vaultScope?: string | null) {
    const canvas = await this.loadCanvas(id, false);
    await this.access.assertAccessToVaultOf(userId, canvas, VaultRole.EDITOR, vaultScope);
    return orNotFound(
      this.prisma.canvas.update({ where: { id }, data: { deletedAt: new Date() } }),
      `Canvas ${id} not found`,
    );
  }

  async trashFolder(userId: string, id: string, vaultScope?: string | null) {
    const folder = await this.loadFolder(id, false);
    await this.access.assertAccessToVaultOf(userId, folder, VaultRole.EDITOR, vaultScope);

    const ids = await this.collectFolderSubtreeIds(folder.id, folder.vaultId, false);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.folder.updateMany({
        where: { id: { in: ids.folderIds } },
        data: { deletedAt: now },
      }),
      this.prisma.note.updateMany({ where: { id: { in: ids.noteIds } }, data: { deletedAt: now } }),
      this.prisma.canvas.updateMany({
        where: { id: { in: ids.canvasIds } },
        data: { deletedAt: now },
      }),
    ]);
    return {
      id: folder.id,
      folderCount: ids.folderIds.length,
      noteCount: ids.noteIds.length,
      canvasCount: ids.canvasIds.length,
    };
  }

  // ── Restore ───────────────────────────────────────────────────────────────

  async restoreNote(userId: string, id: string, vaultScope?: string | null) {
    const note = await this.loadNote(id, true);
    await this.access.assertAccessToVaultOf(userId, note, VaultRole.EDITOR, vaultScope);
    return orNotFound(
      this.prisma.note.update({ where: { id }, data: { deletedAt: null } }),
      `Note ${id} not found`,
    );
  }

  async restoreCanvas(userId: string, id: string, vaultScope?: string | null) {
    const canvas = await this.loadCanvas(id, true);
    await this.access.assertAccessToVaultOf(userId, canvas, VaultRole.EDITOR, vaultScope);
    return orNotFound(
      this.prisma.canvas.update({ where: { id }, data: { deletedAt: null } }),
      `Canvas ${id} not found`,
    );
  }

  /**
   * Restores the folder and every currently-trashed descendant in one shot. A descendant
   * can only be trashed while its parent is live if it was trashed independently before
   * the parent was — trashing a folder always cascades in the same transaction — so
   * sweeping up everything still marked deleted under this subtree is always correct,
   * not just "whatever was trashed in the same cascade".
   */
  async restoreFolder(userId: string, id: string, vaultScope?: string | null) {
    const folder = await this.loadFolder(id, true);
    await this.access.assertAccessToVaultOf(userId, folder, VaultRole.EDITOR, vaultScope);

    const ids = await this.collectFolderSubtreeIds(folder.id, folder.vaultId, true);
    await this.prisma.$transaction([
      this.prisma.folder.updateMany({
        where: { id: { in: ids.folderIds } },
        data: { deletedAt: null },
      }),
      this.prisma.note.updateMany({
        where: { id: { in: ids.noteIds } },
        data: { deletedAt: null },
      }),
      this.prisma.canvas.updateMany({
        where: { id: { in: ids.canvasIds } },
        data: { deletedAt: null },
      }),
    ]);
    return { id: folder.id };
  }

  // ── Purge (permanent) ────────────────────────────────────────────────────

  async purgeNote(userId: string, id: string, vaultScope?: string | null) {
    const note = await this.loadNote(id, true);
    await this.access.assertAccessToVaultOf(userId, note, VaultRole.EDITOR, vaultScope);
    await orNotFound(this.prisma.note.delete({ where: { id } }), `Note ${id} not found`);
  }

  async purgeCanvas(userId: string, id: string, vaultScope?: string | null) {
    const canvas = await this.loadCanvas(id, true);
    await this.access.assertAccessToVaultOf(userId, canvas, VaultRole.EDITOR, vaultScope);
    await orNotFound(this.prisma.canvas.delete({ where: { id } }), `Canvas ${id} not found`);
  }

  /**
   * Explicit recursive purge — deliberately not left to Folder.parent's FK cascade.
   * Note/Canvas.folder is onDelete: SetNull, so a bare folder.delete() here would
   * silently un-trash-orphan any not-yet-purged trashed notes/canvases inside it to
   * root, instead of deleting them. Notes/canvases must be removed before their folder.
   */
  async purgeFolder(userId: string, id: string, vaultScope?: string | null) {
    const folder = await this.loadFolder(id, true);
    await this.access.assertAccessToVaultOf(userId, folder, VaultRole.EDITOR, vaultScope);

    const ids = await this.collectFolderSubtreeIds(folder.id, folder.vaultId, true);
    await this.prisma.$transaction([
      this.prisma.note.deleteMany({ where: { id: { in: ids.noteIds } } }),
      this.prisma.canvas.deleteMany({ where: { id: { in: ids.canvasIds } } }),
      this.prisma.folder.deleteMany({ where: { id: { in: ids.folderIds } } }),
    ]);
  }

  // ── Dispatch by type (controller entry points) ───────────────────────────

  async restore(userId: string, type: TrashItemType, id: string, vaultScope?: string | null) {
    switch (type) {
      case "note":
        return this.restoreNote(userId, id, vaultScope);
      case "canvas":
        return this.restoreCanvas(userId, id, vaultScope);
      case "folder":
        return this.restoreFolder(userId, id, vaultScope);
    }
  }

  async purge(userId: string, type: TrashItemType, id: string, vaultScope?: string | null) {
    switch (type) {
      case "note":
        return this.purgeNote(userId, id, vaultScope);
      case "canvas":
        return this.purgeCanvas(userId, id, vaultScope);
      case "folder":
        return this.purgeFolder(userId, id, vaultScope);
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  /**
   * Only top-level trashed items: a note/canvas/subfolder nested inside a trashed folder
   * is already represented by that folder's row (and comes back with it on restore), so
   * listing it separately too would double it up in the UI.
   */
  async list(
    userId: string,
    vaultId?: string,
    vaultScope?: string | null,
  ): Promise<TrashItemSummary[]> {
    const accessible = await this.access.accessibleVaultIds(userId, vaultScope);
    const scoped = vaultId ? accessible.filter((id) => id === vaultId) : accessible;

    const [notes, folders, canvases] = await Promise.all([
      this.prisma.note.findMany({
        where: { vaultId: { in: scoped }, deletedAt: { not: null } },
        select: { id: true, title: true, vaultId: true, folderId: true, deletedAt: true },
      }),
      this.prisma.folder.findMany({
        where: { vaultId: { in: scoped }, deletedAt: { not: null } },
        select: { id: true, name: true, vaultId: true, parentId: true, deletedAt: true },
      }),
      this.prisma.canvas.findMany({
        where: { vaultId: { in: scoped }, deletedAt: { not: null } },
        select: { id: true, title: true, vaultId: true, folderId: true, deletedAt: true },
      }),
    ]);

    const trashedFolderIds = new Set(folders.map((f) => f.id));
    const topFolders = folders.filter((f) => !f.parentId || !trashedFolderIds.has(f.parentId));
    const topNotes = notes.filter((n) => !n.folderId || !trashedFolderIds.has(n.folderId));
    const topCanvases = canvases.filter((c) => !c.folderId || !trashedFolderIds.has(c.folderId));

    const folderItems: TrashItemSummary[] = await Promise.all(
      topFolders.map(async (f) => {
        const ids = await this.collectFolderSubtreeIds(f.id, f.vaultId, true);
        const itemCount = ids.folderIds.length - 1 + ids.noteIds.length + ids.canvasIds.length;
        return {
          type: "folder" as const,
          id: f.id,
          title: f.name,
          vaultId: f.vaultId,
          // Non-null: this row only exists in the `folders` array because deletedAt was filtered `not: null`.
          deletedAt: f.deletedAt as Date,
          itemCount,
        };
      }),
    );

    const noteItems: TrashItemSummary[] = topNotes.map((n) => ({
      type: "note" as const,
      id: n.id,
      title: n.title,
      vaultId: n.vaultId,
      deletedAt: n.deletedAt as Date,
    }));

    const canvasItems: TrashItemSummary[] = topCanvases.map((c) => ({
      type: "canvas" as const,
      id: c.id,
      title: c.title,
      vaultId: c.vaultId,
      deletedAt: c.deletedAt as Date,
    }));

    return [...folderItems, ...noteItems, ...canvasItems].sort(
      (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime(),
    );
  }

  // ── Scheduled purge ──────────────────────────────────────────────────────

  /**
   * System job: no per-user auth, cross-vault. Because trashFolder stamps the same
   * deletedAt on every descendant it cascades, a note/canvas can only carry its own
   * independent deletedAt when it was trashed without its parent folder also being
   * trashed at that moment — so purging notes/canvases before folders, purely by cutoff
   * with no tree walk, is always correct: nothing here ever depends on the live
   * Note/Canvas.folder SetNull FK, because both are always gone before their folder row.
   */
  async purgeExpired(
    retentionMs: number,
  ): Promise<{ notes: number; canvases: number; folders: number }> {
    const cutoff = new Date(Date.now() - retentionMs);
    const notes = await this.prisma.note.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    const canvases = await this.prisma.canvas.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    const folders = await this.prisma.folder.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    return { notes: notes.count, canvases: canvases.count, folders: folders.count };
  }
}
