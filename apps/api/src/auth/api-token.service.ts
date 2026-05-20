import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateTokenDto } from "./dto/create-token.dto.js";
import type { AuthenticatedUser } from "./jwt.strategy.js";

export interface ApiTokenValidationResult {
  user: AuthenticatedUser;
  tokenId: string;
}

@Injectable()
export class ApiTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  async create(userId: string, dto: CreateTokenDto) {
    const raw = `ndra_${randomBytes(32).toString("hex")}`;
    const tokenHash = this.hash(raw);

    const record = await this.prisma.apiToken.create({
      data: {
        name: dto.name,
        tokenHash,
        userId,
        vaultId: dto.vaultId ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        vaultId: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return { ...record, token: raw };
  }

  async findAll(userId: string) {
    return this.prisma.apiToken.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        vaultId: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(id: string, userId: string) {
    await this.prisma.apiToken.deleteMany({ where: { id, userId } });
  }

  async validateToken(raw: string): Promise<ApiTokenValidationResult | null> {
    const tokenHash = this.hash(raw);
    const record = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    await this.prisma.apiToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      tokenId: record.id,
      user: {
        id: record.user.id,
        email: record.user.email,
        name: record.user.name,
        role: record.user.role,
        vaultScope: record.vaultId,
      },
    };
  }
}
