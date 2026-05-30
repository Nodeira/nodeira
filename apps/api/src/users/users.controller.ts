import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { UsersService } from "./users.service.js";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me/preferences")
  getPreferences(@Req() req: { user: AuthenticatedUser }) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Patch("me/preferences")
  updatePreferences(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { startupView?: string },
  ) {
    return this.usersService.updatePreferences(req.user.id, body);
  }
}
