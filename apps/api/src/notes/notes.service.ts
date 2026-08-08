import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateNoteDto } from "./dto/create-note.dto.js";
import type { UpdateNoteDto } from "./dto/update-note.dto.js";
import type { ReorderNoteItemDto } from "./dto/reorder-notes.dto.js";
import { MarkdownConverterService } from "./markdown-converter.service.js";
import { DocumentBridge } from "../sync/document-bridge.service.js";

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markdownConverter: MarkdownConverterService,
    private readonly documentBridge: DocumentBridge,
  ) {}

  async create(dto: CreateNoteDto, vaultScope?: string | null) {
    if (vaultScope && dto.vaultId !== vaultScope) {
      throw new ForbiddenException("Token is scoped to a different vault");
    }

    let position = dto.position;
    if (position === undefined) {
      const agg = await this.prisma.note.aggregate({
        where: { folderId: dto.folderId ?? null },
        _max: { position: true },
      });
      position = (agg._max.position ?? -1) + 1;
    }

    return this.prisma.note.create({
      data: {
        title: dto.title ?? "Untitled",
        type: dto.type ?? "note",
        vaultId: dto.vaultId ?? null,
        folderId: dto.folderId ?? null,
        position,
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.kindMeta !== undefined && { kindMeta: dto.kindMeta as Prisma.InputJsonValue }),
      },
    });
  }

  async findAll(vaultId?: string, vaultScope?: string | null, tag?: string) {
    const effectiveVaultId = vaultScope ?? vaultId;
    const notes = await this.prisma.note.findMany({
      where: {
        ...(effectiveVaultId ? { vaultId: effectiveVaultId } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
      },
      select: {
        id: true,
        title: true,
        type: true,
        kind: true,
        kindMeta: true,
        vaultId: true,
        folderId: true,
        pinned: true,
        icon: true,
        position: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        yjsState: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return notes.map(({ yjsState, ...meta }) => ({
      ...meta,
      preview: yjsState
        ? this.markdownConverter.yjsStateToPreview(yjsState as Uint8Array)
        : undefined,
    }));
  }

  async findOne(id: string, vaultScope?: string | null) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    if (vaultScope && note.vaultId !== vaultScope) {
      throw new ForbiddenException("Token is scoped to a different vault");
    }
    return note;
  }

  async update(id: string, dto: UpdateNoteDto, vaultScope?: string | null) {
    await this.findOne(id, vaultScope);
    try {
      return await this.prisma.note.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.pinned !== undefined && { pinned: dto.pinned }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.kindMeta !== undefined && { kindMeta: dto.kindMeta as Prisma.InputJsonValue }),
          ...(dto.folderId !== undefined && { folderId: dto.folderId ?? null }),
          ...(dto.vaultId !== undefined && { vaultId: dto.vaultId ?? null }),
          // `tags` is deliberately not writable here. Tags are derived from hashTag nodes
          // in the document by syncTags() on every sync flush, so anything written through
          // REST was silently wiped moments later. The document is the single source of
          // truth; UpdateNoteDto no longer accepts the field.
        },
      });
    } catch {
      throw new NotFoundException(`Note ${id} not found`);
    }
  }

  async reorder(items: ReorderNoteItemDto[], vaultScope?: string | null) {
    await Promise.all(
      items.map(async (item) => {
        await this.findOne(item.id, vaultScope);
        const data: { position: number; folderId?: string | null } = {
          position: item.position,
        };
        if (item.folderId !== undefined) {
          data.folderId = item.folderId ?? null;
        }
        return this.prisma.note.update({ where: { id: item.id }, data });
      }),
    );
  }

  async remove(id: string, vaultScope?: string | null) {
    await this.findOne(id, vaultScope);
    try {
      return await this.prisma.note.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Note ${id} not found`);
    }
  }

  /** Returns the number of rows written — 0 means the note no longer exists. */
  async updateYjsState(id: string, yjsState: Uint8Array<ArrayBuffer>): Promise<number> {
    // updateMany affects 0 rows (no throw) when the note was deleted, so a still-open
    // editor connection can never resurrect a deleted note as an orphaned ghost.
    // Real notes are always created via POST /notes (with a vaultId) before sync runs.
    const { count } = await this.prisma.note.updateMany({ where: { id }, data: { yjsState } });
    return count;
  }

  async syncLinks(sourceId: string, targetIds: string[]) {
    // Drop self-links: a note linking to itself adds nothing to the graph and shows up as
    // its own backlink.
    const wanted = [...new Set(targetIds)].filter((id) => id !== sourceId);

    const validNotes =
      wanted.length > 0
        ? await this.prisma.note.findMany({
            where: { id: { in: wanted } },
            select: { id: true },
          })
        : [];
    const validIds = validNotes.map((n) => n.id);

    // One transaction: delete-then-recreate left the note with zero backlinks for anyone
    // reading in between, and left them deleted permanently if the process died between
    // the two statements.
    await this.prisma.$transaction([
      this.prisma.noteLink.deleteMany({ where: { sourceId } }),
      ...(validIds.length > 0
        ? [
            this.prisma.noteLink.createMany({
              data: validIds.map((targetId) => ({ sourceId, targetId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  async syncTags(id: string, tags: string[]) {
    await this.prisma.note.update({ where: { id }, data: { tags } });
  }

  async getAllTags(vaultScope?: string | null): Promise<{ tag: string; count: number }[]> {
    const notes = await this.prisma.note.findMany({
      where: vaultScope ? { vaultId: vaultScope } : {},
      select: { tags: true },
    });
    const tagCount = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) {
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
    return [...tagCount.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getBacklinks(targetId: string, vaultScope?: string | null) {
    await this.findOne(targetId, vaultScope);
    const links = await this.prisma.noteLink.findMany({
      where: { targetId, ...(vaultScope ? { source: { vaultId: vaultScope } } : {}) },
      include: {
        source: {
          select: {
            id: true,
            title: true,
            type: true,
            kind: true,
            kindMeta: true,
            vaultId: true,
            folderId: true,
            pinned: true,
            icon: true,
            position: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return links.map((l) => l.source);
  }

  async getOutLinks(sourceId: string, vaultScope?: string | null) {
    await this.findOne(sourceId, vaultScope);
    const links = await this.prisma.noteLink.findMany({
      where: { sourceId },
      include: {
        target: {
          select: {
            id: true,
            title: true,
            type: true,
            kind: true,
            kindMeta: true,
            vaultId: true,
            folderId: true,
            pinned: true,
            icon: true,
            position: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return links.map((l) => l.target);
  }

  async getAllLinks(vaultScope?: string | null) {
    return this.prisma.noteLink.findMany({
      where: vaultScope ? { source: { vaultId: vaultScope } } : {},
      select: { sourceId: true, targetId: true },
    });
  }

  async getContent(id: string, vaultScope?: string | null): Promise<{ content: string }> {
    const note = await this.findOne(id, vaultScope);
    if (!note.yjsState) return { content: "" };
    const content = await this.markdownConverter.yjsStateToMarkdown(note.yjsState as Uint8Array);
    return { content };
  }

  async setContent(id: string, markdown: string, vaultScope?: string | null): Promise<void> {
    await this.findOne(id, vaultScope);

    // Built before the transaction because the callback is synchronous. Detached Yjs
    // elements can be inserted into any fragment, so this is safe.
    const elements = await this.markdownConverter.markdownToXmlElements(markdown);

    // Route through the sync server so the change lands as an update on the document
    // everyone is already sharing. Overwriting yjs_state directly (as this used to do)
    // is lost the moment a connected editor flushes, and the diverged state vectors can
    // never reconcile. The bridge persists via onStoreDocument, so there is no separate
    // write on this path.
    const applied = await this.documentBridge.transact(id, (doc) => {
      const fragment = doc.getXmlFragment("default");
      fragment.delete(0, fragment.length);
      if (elements.length > 0) fragment.insert(0, elements);
    });

    if (applied) return;

    // Sync server unavailable (e.g. a unit test constructing the service directly).
    const yjsState = await this.markdownConverter.markdownToYjsState(markdown);
    await this.prisma.note.update({ where: { id }, data: { yjsState: Buffer.from(yjsState) } });
  }
}
