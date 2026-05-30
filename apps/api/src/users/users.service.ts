import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import bcrypt from "bcryptjs";

export interface UserPreferences {
  startupView?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; password: string; name?: string }) {
    const hashed = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name ?? null, role: "ADMIN" },
    });
  }

  count() {
    return this.prisma.user.count();
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const p = user?.preferences;
    if (p && typeof p === "object" && !Array.isArray(p)) return p as UserPreferences;
    return {};
  }

  async updatePreferences(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...patch };
    await this.prisma.user.update({ where: { id: userId }, data: { preferences: updated } });
    return updated;
  }
}
