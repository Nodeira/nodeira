import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { lookup } from "dns/promises";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateCanvasDto } from "./dto/create-canvas.dto.js";
import type { UpdateCanvasDto } from "./dto/update-canvas.dto.js";
import type { OgPreview } from "@nodeira/shared-types";
import type { Prisma } from "@prisma/client";

@Injectable()
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vaultId?: string, vaultScope?: string | null, q?: string) {
    const effectiveVaultId = vaultScope ?? vaultId;
    return this.prisma.canvas.findMany({
      where: {
        ...(effectiveVaultId ? { vaultId: effectiveVaultId } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async findOne(id: string, vaultScope?: string | null) {
    const canvas = await this.prisma.canvas.findUnique({ where: { id } });
    if (!canvas) throw new NotFoundException(`Canvas ${id} not found`);
    if (vaultScope && canvas.vaultId !== vaultScope) {
      throw new ForbiddenException("Token is scoped to a different vault");
    }
    return canvas;
  }

  async create(dto: CreateCanvasDto, vaultScope?: string | null) {
    if (vaultScope && dto.vaultId !== vaultScope) {
      throw new ForbiddenException("Token is scoped to a different vault");
    }

    const agg = await this.prisma.canvas.aggregate({
      where: { vaultId: dto.vaultId ?? null },
      _max: { position: true },
    });
    const position = (agg._max.position ?? -1) + 1;

    return this.prisma.canvas.create({
      data: {
        title: dto.title ?? "Untitled Canvas",
        vaultId: dto.vaultId ?? null,
        folderId: dto.folderId ?? null,
        position,
      },
    });
  }

  async update(id: string, dto: UpdateCanvasDto, vaultScope?: string | null) {
    const canvas = await this.findOne(id, vaultScope);
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

  async remove(id: string, vaultScope?: string | null) {
    await this.findOne(id, vaultScope);
    await this.prisma.canvas.delete({ where: { id } });
  }

  private isPrivateIp(ip: string): boolean {
    if (ip === "localhost" || ip === "::1") return true;
    if (ip.startsWith("127.") || ip.startsWith("169.254.") || ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
    const m = /^172\.(\d+)\./.exec(ip);
    if (m && parseInt(m[1]!) >= 16 && parseInt(m[1]!) <= 31) return true;
    return false;
  }

  private async assertPublicUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new UnprocessableEntityException("Invalid URL");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new UnprocessableEntityException("Only http and https URLs are allowed");
    }
    if (this.isPrivateIp(parsed.hostname)) {
      throw new UnprocessableEntityException("URLs to private networks are not allowed");
    }
    try {
      const { address } = await lookup(parsed.hostname);
      if (this.isPrivateIp(address)) {
        throw new UnprocessableEntityException("URLs to private networks are not allowed");
      }
    } catch (err) {
      if (err instanceof UnprocessableEntityException) throw err;
      throw new UnprocessableEntityException("Could not resolve URL hostname");
    }
  }

  async fetchUrlPreview(url: string): Promise<OgPreview> {
    await this.assertPublicUrl(url);

    let html: string;
    let baseUrl: string;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Nodeira/1.0 (+https://nodeira.app)" },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
      baseUrl = new URL(url).origin;
    } catch (err) {
      if (err instanceof UnprocessableEntityException) throw err;
      throw new UnprocessableEntityException("Could not fetch URL");
    }

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
