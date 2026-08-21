import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateCanvasDto } from "./dto/create-canvas.dto.js";
import type { UpdateCanvasDto } from "./dto/update-canvas.dto.js";
import type { OgPreview } from "@nodeira/shared-types";
import { safeFetchHtml } from "./safe-fetch.js";
import { VaultRole, type Prisma } from "@prisma/client";
import { VaultAccessService } from "../vaults/vault-access.service.js";

@Injectable()
export class CanvasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VaultAccessService,
  ) {}

  async findAll(userId: string, vaultId?: string, vaultScope?: string | null, q?: string) {
    const accessible = await this.access.accessibleVaultIds(userId, vaultScope);
    const scoped = vaultId ? accessible.filter((id) => id === vaultId) : accessible;
    return this.prisma.canvas.findMany({
      where: {
        vaultId: { in: scoped },
        deletedAt: null,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async findOne(
    userId: string,
    id: string,
    vaultScope?: string | null,
    minRole: VaultRole = VaultRole.VIEWER,
  ) {
    const canvas = await this.prisma.canvas.findUnique({ where: { id } });
    // A trashed canvas reads as not-found everywhere except the trash endpoints
    // themselves (TrashService has its own lookup that can see it).
    if (!canvas || canvas.deletedAt) throw new NotFoundException(`Canvas ${id} not found`);
    await this.access.assertAccessToVaultOf(userId, canvas, minRole, vaultScope);
    return canvas;
  }

  async create(userId: string, dto: CreateCanvasDto, vaultScope?: string | null) {
    await this.access.assertAccess(userId, dto.vaultId, VaultRole.EDITOR, vaultScope);

    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({ where: { id: dto.folderId } });
      if (!folder || folder.deletedAt) {
        throw new NotFoundException(`Folder ${dto.folderId} not found`);
      }
      if (folder.vaultId !== dto.vaultId) {
        throw new NotFoundException(`Folder ${dto.folderId} not found`);
      }
    }

    const agg = await this.prisma.canvas.aggregate({
      where: { vaultId: dto.vaultId },
      _max: { position: true },
    });
    const position = (agg._max.position ?? -1) + 1;

    return this.prisma.canvas.create({
      data: {
        title: dto.title ?? "Untitled Canvas",
        vaultId: dto.vaultId,
        folderId: dto.folderId ?? null,
        position,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateCanvasDto, vaultScope?: string | null) {
    const canvas = await this.findOne(userId, id, vaultScope, VaultRole.EDITOR);

    // Moving a canvas into another vault requires write access to the destination too,
    // otherwise a member of vault A could push canvases into vault B. Mirrors notes.service.
    if (dto.vaultId !== undefined) {
      await this.access.assertAccess(userId, dto.vaultId, VaultRole.EDITOR, vaultScope);
    }

    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({ where: { id: dto.folderId } });
      if (!folder || folder.deletedAt) {
        throw new NotFoundException(`Folder ${dto.folderId} not found`);
      }
      // A folder belongs to exactly one vault; moving a canvas into a folder from another
      // vault would silently detach it from the vault membership that authorizes it.
      const targetVaultId = dto.vaultId ?? canvas.vaultId;
      if (folder.vaultId !== targetVaultId) {
        throw new NotFoundException(`Folder ${dto.folderId} not found`);
      }
    }

    return this.prisma.canvas.update({
      where: { id: canvas.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.data !== undefined && { data: dto.data as Prisma.InputJsonValue }),
        ...(dto.pinned !== undefined && { pinned: dto.pinned }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
        ...(dto.vaultId !== undefined && { vaultId: dto.vaultId }),
      },
    });
  }

  async fetchUrlPreview(url: string): Promise<OgPreview> {
    // safeFetchHtml validates every redirect hop and pins the socket to an address that
    // was checked at connect time, so a hostname cannot resolve public for the check and
    // private for the request.
    const { html, finalUrl } = await safeFetchHtml(url);
    const baseUrl = new URL(finalUrl).origin;

    const getTag = (property: string): string | null => {
      const ogMatch = html.match(
        new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, "i"),
      );
      if (ogMatch) return ogMatch[1] ?? null;
      const nameMatch = html.match(
        new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
      );
      return nameMatch?.[1] ?? null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const resolveUrl = (href: string | null): string | null => {
      if (!href) return null;
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return null;
      }
    };

    const faviconMatch = html.match(
      /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
    );

    return {
      title: getTag("title") ?? titleMatch?.[1]?.trim() ?? null,
      description: getTag("description") ?? null,
      image: resolveUrl(getTag("image")),
      favicon: resolveUrl(faviconMatch?.[1] ?? null) ?? `${baseUrl}/favicon.ico`,
      url,
    };
  }
}
