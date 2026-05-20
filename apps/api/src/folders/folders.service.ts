import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateFolderDto } from "./dto/create-folder.dto.js";

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFolderDto) {
    return this.prisma.folder.create({ data: { name: dto.name, vaultId: dto.vaultId ?? null } });
  }

  async findAll(vaultId?: string, vaultScope?: string | null) {
    const effectiveVaultId = vaultScope ?? vaultId;
    return this.prisma.folder.findMany({
      ...(effectiveVaultId ? { where: { vaultId: effectiveVaultId } } : {}),
      orderBy: { name: "asc" },
    });
  }

  async update(id: string, data: { icon?: string | null }) {
    try {
      return await this.prisma.folder.update({ where: { id }, data });
    } catch {
      throw new NotFoundException(`Folder ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.folder.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Folder ${id} not found`);
    }
  }
}
