import { Body, Controller, Get, Patch, Post, Request, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { UsersService } from "./users.service.js";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Directory for the vault-sharing picker, so any authenticated user can read it. Returns
   * id/email/name/role only — never password hashes.
   */
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Admin-only account creation. There is deliberately no public registration endpoint:
   * this is a self-hosted app, and an internet-reachable instance should not be
   * registerable by strangers.
   */
  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  @Get("me/preferences")
  getPreferences(@Request() req: RequestWithUser) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Patch("me/preferences")
  updatePreferences(@Request() req: RequestWithUser, @Body() body: { startupView?: string }) {
    return this.usersService.updatePreferences(req.user.id, body);
  }
}
