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

  async findAll(vaultId?: string, vaultScope?: string | null) {
    const effectiveVaultId = vaultScope ?? vaultId;
    return this.prisma.note.findMany({
      ...(effectiveVaultId ? { where: { vaultId: effectiveVaultId } } : {}),
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
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
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
        },
      });
    } catch {
      throw new NotFoundException(`Note ${id} not found`);
    }
  }

  async reorder(items: ReorderNoteItemDto[]) {
    await Promise.all(
      items.map((item) => {
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

  async upsertYjsState(id: string, yjsState: Uint8Array<ArrayBuffer>) {
    await this.prisma.note.upsert({
      where: { id },
      update: { yjsState },
      create: { id, yjsState, title: "Untitled", type: "note", position: 0 },
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
