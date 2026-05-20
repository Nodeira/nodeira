import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { VaultsService } from "./vaults.service.js";
import { CreateVaultDto } from "./dto/create-vault.dto.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@UseGuards(JwtAuthGuard)
@Controller("vaults")
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Post()
  create(@Body() dto: CreateVaultDto) {
    return this.vaultsService.create(dto);
  }

  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.vaultsService.findAll(req.user.vaultScope);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.vaultsService.remove(id);
  }
}
