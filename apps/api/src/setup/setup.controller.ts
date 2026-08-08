import { Throttle } from "@nestjs/throttler";
import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateAdminDto } from "./dto/create-admin.dto.js";
import { SetupService } from "./setup.service.js";

@ApiTags("setup")
@Controller("setup")
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get("status")
  async status() {
    return { setupRequired: await this.setupService.isSetupRequired() };
  }

  // Unauthenticated by necessity (it creates the first account), so it needs its own limit.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.setupService.createAdmin(dto);
  }
}
