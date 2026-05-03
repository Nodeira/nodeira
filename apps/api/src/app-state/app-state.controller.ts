import { Body, Controller, Get, Patch } from "@nestjs/common";
import { AppStateService, type AppStateDto } from "./app-state.service.js";

@Controller("app-state")
export class AppStateController {
  constructor(private readonly service: AppStateService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  patch(@Body() body: Partial<AppStateDto>) {
    return this.service.patch(body);
  }
}
