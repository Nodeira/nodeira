import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { VaultRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { VaultAccessService } from "../vaults/vault-access.service.js";
import type { CreateFolderDto } from "./dto/create-folder.dto.js";

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VaultAccessService,
  ) {}

  /** Loads a folder and authorizes the caller against its vault. */
  private async findAuthorized(
    userId: string,
    id: string,
    minRole: VaultRole,
    vaultScope?: string | null,
  ) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException(`Folder ${id} not found`);
    await this.access.assertAccessToVaultOf(userId, folder, minRole, vaultScope);
    return folder;
  }

  async create(userId: string, dto: CreateFolderDto, vaultScope?: string | null) {
    await this.access.assertAccess(userId, dto.vaultId, VaultRole.EDITOR, vaultScope);

    if (dto.parentId) {
      // A parent in another vault would put the child somewhere the caller may not even
      // be able to see, and would let a folder tree span vaults.
      const parent = await this.findAuthorized(userId, dto.parentId, VaultRole.EDITOR, vaultScope);
      if (parent.vaultId !== dto.vaultId) {
        throw new BadRequestException("Parent folder belongs to a different vault");
      }
    }

    return this.prisma.folder.create({
      data: { name: dto.name, vaultId: dto.vaultId, parentId: dto.parentId ?? null },
    });
  }

  async findAll(userId: string, vaultId?: string, vaultScope?: string | null) {
    const ids = await this.access.accessibleVaultIds(userId, vaultScope);
    const scoped = vaultId ? ids.filter((id) => id === vaultId) : ids;
    return this.prisma.folder.findMany({
      where: { vaultId: { in: scoped } },
      orderBy: { name: "asc" },
    });
  }

  async update(
    userId: string,
    id: string,
    data: { icon?: string | null },
    vaultScope?: string | null,
  ) {
    await this.findAuthorized(userId, id, VaultRole.EDITOR, vaultScope);
    return this.prisma.folder.update({ where: { id }, data });
  }

  async remove(userId: string, id: string, vaultScope?: string | null) {
    await this.findAuthorized(userId, id, VaultRole.EDITOR, vaultScope);
    return this.prisma.folder.delete({ where: { id } });
  }
}
