import { ConflictException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { VaultAccessService } from "../vaults/vault-access.service.js";
import bcrypt from "bcryptjs";

export interface UserPreferences {
  startupView?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VaultAccessService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Creates a user and the personal vault they start out owning.
   *
   * `role` used to be hardcoded to ADMIN here, which is why the Role enum never meant
   * anything. Setup passes ADMIN explicitly for the first account; everyone else defaults
   * to USER.
   *
   * The vault is created in the same call because content now requires one, so a user
   * without a vault could not create a single note.
   */
  async create(data: { email: string; password: string; name?: string; role?: Role }) {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException("A user with that email already exists");

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        name: data.name ?? null,
        role: data.role ?? Role.USER,
      },
    });
    await this.access.createVault(user.id, "Main vault");
    return user;
  }

  /** Directory for the vault-sharing picker. Deliberately excludes password hashes. */
  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
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

  async updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...patch };
    await this.prisma.user.update({ where: { id: userId }, data: { preferences: updated } });
    return updated;
  }
}
