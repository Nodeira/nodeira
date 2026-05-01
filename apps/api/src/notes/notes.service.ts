import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateNoteDto } from "./dto/create-note.dto.js";
import type { UpdateNoteDto } from "./dto/update-note.dto.js";
import type { ReorderNoteItemDto } from "./dto/reorder-notes.dto.js";

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNoteDto) {
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

  async findAll(vaultId?: string) {
    return this.prisma.note.findMany({
      ...(vaultId ? { where: { vaultId } } : {}),
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

  async findOne(id: string) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    return note;
  }

  async update(id: string, dto: UpdateNoteDto) {
    try {
      return await this.prisma.note.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.pinned !== undefined && { pinned: dto.pinned }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.kindMeta !== undefined && { kindMeta: dto.kindMeta as Prisma.InputJsonValue }),
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

  async remove(id: string) {
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
}
