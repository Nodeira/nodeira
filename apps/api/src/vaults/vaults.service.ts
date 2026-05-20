import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateVaultDto } from "./dto/create-vault.dto.js";

@Injectable()
export class VaultsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seed();
  }

  private async seed() {
    const count = await this.prisma.vault.count();
    if (count > 0) return;

    const vault = await this.prisma.vault.create({ data: { name: "Main vault" } });
    await Promise.all([
      this.prisma.note.updateMany({ where: { vaultId: null }, data: { vaultId: vault.id } }),
      this.prisma.folder.updateMany({ where: { vaultId: null }, data: { vaultId: vault.id } }),
    ]);
  }

  async create(dto: CreateVaultDto) {
    return this.prisma.vault.create({ data: { name: dto.name } });
  }

  async findAll(vaultScope?: string | null) {
    if (vaultScope) {
      const vault = await this.prisma.vault.findUnique({ where: { id: vaultScope } });
      return vault ? [vault] : [];
    }
    return this.prisma.vault.findMany({ orderBy: { createdAt: "asc" } });
  }

  async remove(id: string) {
    const notes = await this.prisma.note.count({ where: { vaultId: id } });
    const folders = await this.prisma.folder.count({ where: { vaultId: id } });
    if (notes > 0 || folders > 0) {
      throw new Error("Cannot delete a vault that contains notes or folders");
    }
    try {
      return await this.prisma.vault.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Vault ${id} not found`);
    }
  }
}
