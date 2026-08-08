import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { VaultRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateVaultDto } from "./dto/create-vault.dto.js";
import { VaultAccessService } from "./vault-access.service.js";

@Injectable()
export class VaultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VaultAccessService,
  ) {}

  // NOTE: the old onModuleInit seed is gone. It created a "Main vault" on boot and adopted
  // orphaned notes and folders — neither of which is possible now that a vault requires an
  // owner and content requires a vault. The first vault is created for the admin during
  // setup instead (see SetupService), and every subsequent user gets one on creation.

  async create(userId: string, dto: CreateVaultDto) {
    return this.access.createVault(userId, dto.name);
  }

  async findAll(userId: string, vaultScope?: string | null) {
    const ids = await this.access.accessibleVaultIds(userId, vaultScope);
    return this.prisma.vault.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Members of a vault the caller can see. Any member may view the roster. */
  async listMembers(userId: string, vaultId: string, vaultScope?: string | null) {
    await this.access.assertAccess(userId, vaultId, VaultRole.VIEWER, vaultScope);
    return this.prisma.vaultMember.findMany({
      where: { vaultId },
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Shares a vault with another user. Owner-only. */
  async addMember(
    userId: string,
    vaultId: string,
    targetUserId: string,
    role: VaultRole,
    vaultScope?: string | null,
  ) {
    await this.access.assertAccess(userId, vaultId, VaultRole.OWNER, vaultScope);

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException(`User ${targetUserId} not found`);

    return this.prisma.vaultMember.upsert({
      where: { vaultId_userId: { vaultId, userId: targetUserId } },
      update: { role },
      create: { vaultId, userId: targetUserId, role },
    });
  }

  async removeMember(
    userId: string,
    vaultId: string,
    targetUserId: string,
    vaultScope?: string | null,
  ) {
    await this.access.assertAccess(userId, vaultId, VaultRole.OWNER, vaultScope);

    const vault = await this.prisma.vault.findUnique({ where: { id: vaultId } });
    if (vault?.ownerId === targetUserId) {
      // Removing the owner would leave a vault whose ownerId points at a non-member,
      // and nobody able to re-share it.
      throw new BadRequestException("Cannot remove the vault owner");
    }

    await this.prisma.vaultMember.deleteMany({ where: { vaultId, userId: targetUserId } });
  }

  async remove(userId: string, id: string, vaultScope?: string | null) {
    await this.access.assertAccess(userId, id, VaultRole.OWNER, vaultScope);

    const [notes, folders, canvases] = await Promise.all([
      this.prisma.note.count({ where: { vaultId: id } }),
      this.prisma.folder.count({ where: { vaultId: id } }),
      // Canvases were never counted here, so a vault holding only canvases could be
      // deleted — and now that the FK cascades, that would take them with it.
      this.prisma.canvas.count({ where: { vaultId: id } }),
    ]);
    if (notes > 0 || folders > 0 || canvases > 0) {
      // Was a bare Error, which Nest surfaces as a 500 rather than a client error.
      throw new BadRequestException("Cannot delete a vault that still contains content");
    }

    try {
      return await this.prisma.vault.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Vault ${id} not found`);
    }
  }
}
