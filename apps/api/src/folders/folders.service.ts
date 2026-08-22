import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { VaultRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { VaultAccessService } from "../vaults/vault-access.service.js";
import type { CreateFolderDto } from "./dto/create-folder.dto.js";
import type { UpdateFolderDto } from "./dto/update-folder.dto.js";

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VaultAccessService,
  ) {}

  /**
   * Loads a folder and authorizes the caller against its vault. A trashed folder reads
   * as not-found here — only the trash endpoints (TrashService) can see it.
   */
  private async findAuthorized(
    userId: string,
    id: string,
    minRole: VaultRole,
    vaultScope?: string | null,
  ) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.deletedAt) throw new NotFoundException(`Folder ${id} not found`);
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
      where: { vaultId: { in: scoped }, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async update(userId: string, id: string, dto: UpdateFolderDto, vaultScope?: string | null) {
    const folder = await this.findAuthorized(userId, id, VaultRole.EDITOR, vaultScope);
    const targetVaultId = dto.vaultId ?? folder.vaultId;

    // Moving a folder into another vault requires write access to the destination too,
    // otherwise a member of vault A could push folders (and, by extension, everything
    // moved into them later) into vault B. Mirrors NotesService.update.
    if (dto.vaultId !== undefined) {
      await this.access.assertAccess(userId, dto.vaultId, VaultRole.EDITOR, vaultScope);
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      // A parent in another vault would put the child somewhere the caller may not even
      // be able to see, and would let a folder tree span vaults. Mirrors create().
      const parent = await this.findAuthorized(userId, dto.parentId, VaultRole.EDITOR, vaultScope);
      if (parent.vaultId !== targetVaultId) {
        throw new BadRequestException("Parent folder belongs to a different vault");
      }

      // Cycle check: walk up from the proposed new parent; if the walk reaches `id`, this
      // folder would become its own ancestor. create() never needs this — a brand-new
      // folder can't already have descendants — but update() is the first place a cycle
      // becomes possible.
      let cursorId: string | null = parent.id;
      const seen = new Set<string>();
      while (cursorId) {
        if (cursorId === id) {
          throw new BadRequestException("Cannot move a folder into its own subtree");
        }
        if (seen.has(cursorId)) break; // defensive against bad data; avoids an infinite loop
        seen.add(cursorId);
        const next: { parentId: string | null } | null = await this.prisma.folder.findUnique({
          where: { id: cursorId },
          select: { parentId: true },
        });
        cursorId = next?.parentId ?? null;
      }
    }

    return this.prisma.folder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.vaultId !== undefined && { vaultId: dto.vaultId }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
      },
    });
  }
}
