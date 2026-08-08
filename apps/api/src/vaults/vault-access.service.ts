import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { VaultRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

/** Ascending capability. VIEWER can read; EDITOR can also write; OWNER can also share/delete. */
const RANK: Record<VaultRole, number> = {
  [VaultRole.VIEWER]: 0,
  [VaultRole.EDITOR]: 1,
  [VaultRole.OWNER]: 2,
};

/**
 * The one place that answers "may this user touch this vault?".
 *
 * Notes, folders and canvases have no owner of their own — they are reachable exactly
 * when the caller is a member of their vault. That makes vault membership the single
 * authorization primitive and keeps the check off individual rows.
 *
 * It also folds in API-token vault scope. A token scoped to a vault may only ever
 * *narrow* what its user can reach, never widen it: the token's scope is intersected
 * with the user's memberships rather than replacing them.
 */
@Injectable()
export class VaultAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vault ids the caller may act on, already intersected with any token scope.
   * Returns [] when a scoped token points at a vault the user is not a member of.
   */
  async accessibleVaultIds(userId: string, vaultScope?: string | null): Promise<string[]> {
    const memberships = await this.prisma.vaultMember.findMany({
      where: { userId, ...(vaultScope ? { vaultId: vaultScope } : {}) },
      select: { vaultId: true },
    });
    return memberships.map((m) => m.vaultId);
  }

  /**
   * Throws unless the caller holds at least `minRole` in `vaultId`.
   *
   * NotFound rather than Forbidden for non-members: whether a given vault exists is
   * itself information a non-member should not get.
   */
  async assertAccess(
    userId: string,
    vaultId: string,
    minRole: VaultRole = VaultRole.EDITOR,
    vaultScope?: string | null,
  ): Promise<VaultRole> {
    if (vaultScope && vaultScope !== vaultId) {
      throw new ForbiddenException("Token is scoped to a different vault");
    }

    const membership = await this.prisma.vaultMember.findUnique({
      where: { vaultId_userId: { vaultId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException(`Vault ${vaultId} not found`);

    if (RANK[membership.role] < RANK[minRole]) {
      throw new ForbiddenException(`Requires ${minRole} access to this vault`);
    }
    return membership.role;
  }

  /**
   * Resolves the vault a note/folder/canvas belongs to and authorizes it in one step.
   * `vaultId` is non-nullable on all three, so there is no unreachable-row case.
   */
  async assertAccessToVaultOf(
    userId: string,
    entity: { vaultId: string },
    minRole: VaultRole = VaultRole.EDITOR,
    vaultScope?: string | null,
  ): Promise<VaultRole> {
    return this.assertAccess(userId, entity.vaultId, minRole, vaultScope);
  }

  /** Creates a vault owned by `userId`, with the matching OWNER membership. */
  async createVault(userId: string, name: string) {
    return this.prisma.vault.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: VaultRole.OWNER } },
      },
    });
  }
}
