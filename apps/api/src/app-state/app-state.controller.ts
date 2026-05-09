import { Body, Controller, Get, HttpCode, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { AppStateService, type AppStateDto } from "./app-state.service.js";

@UseGuards(JwtAuthGuard)
@Controller("app-state")
export class AppStateController {
  constructor(private readonly service: AppStateService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  @HttpCode(204)
  patch(@Body() body: Partial<AppStateDto>) {
    return this.service.patch(body);
  }
}
