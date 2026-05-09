import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import bcrypt from "bcryptjs";

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
}
