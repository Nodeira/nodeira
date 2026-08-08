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
    if (!canvas) throw new NotFoundException(`Canvas ${id} not found`);
    await this.access.assertAccessToVaultOf(userId, canvas, minRole, vaultScope);
    return canvas;
  }

  async create(userId: string, dto: CreateCanvasDto, vaultScope?: string | null) {
    await this.access.assertAccess(userId, dto.vaultId, VaultRole.EDITOR, vaultScope);

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
    return this.prisma.canvas.update({
      where: { id: canvas.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.data !== undefined && { data: dto.data as Prisma.InputJsonValue }),
        ...(dto.pinned !== undefined && { pinned: dto.pinned }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });
  }

  async remove(userId: string, id: string, vaultScope?: string | null) {
    await this.findOne(userId, id, vaultScope, VaultRole.EDITOR);
    await this.prisma.canvas.delete({ where: { id } });
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
