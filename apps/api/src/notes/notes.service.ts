import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateNoteDto } from "./dto/create-note.dto.js";
import type { UpdateNoteDto } from "./dto/update-note.dto.js";
import type { ReorderNoteItemDto } from "./dto/reorder-notes.dto.js";
import { MarkdownConverterService } from "./markdown-converter.service.js";

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markdownConverter: MarkdownConverterService,
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
          ...(dto.tags !== undefined && { tags: dto.tags }),
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

  async updateYjsState(id: string, yjsState: Uint8Array<ArrayBuffer>) {
    // updateMany affects 0 rows (no throw) when the note was deleted, so a still-open
    // editor connection can never resurrect a deleted note as an orphaned ghost.
    // Real notes are always created via POST /notes (with a vaultId) before sync runs.
    await this.prisma.note.updateMany({ where: { id }, data: { yjsState } });
  }

  async syncLinks(sourceId: string, targetIds: string[]) {
    const validNotes =
      targetIds.length > 0
        ? await this.prisma.note.findMany({
            where: { id: { in: targetIds } },
            select: { id: true },
          })
        : [];
    const validIds = validNotes.map((n) => n.id);

    await this.prisma.noteLink.deleteMany({ where: { sourceId } });
    if (validIds.length > 0) {
      await this.prisma.noteLink.createMany({
        data: validIds.map((targetId) => ({ sourceId, targetId })),
      });
    }
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
    const yjsState = await this.markdownConverter.markdownToYjsState(markdown);
    await this.prisma.note.update({ where: { id }, data: { yjsState: Buffer.from(yjsState) } });
  }
}
