import { Body, Controller, Get, HttpCode, Patch, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { AppStateService, type AppStateDto } from "./app-state.service.js";

@UseGuards(JwtAuthGuard)
@Controller("app-state")
export class AppStateController {
  constructor(private readonly service: AppStateService) {}

  @Get()
  get(@Request() req: RequestWithUser) {
    return this.service.get(req.user.id);
  }

  @Patch()
  @HttpCode(204)
  patch(@Request() req: RequestWithUser, @Body() body: Partial<AppStateDto>) {
    return this.service.patch(req.user.id, body);
  }
}
