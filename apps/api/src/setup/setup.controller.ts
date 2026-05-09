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

  @Post()
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.setupService.createAdmin(dto);
  }
}
