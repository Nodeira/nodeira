import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { VaultsService } from "./vaults.service.js";
import type { CreateVaultDto } from "./dto/create-vault.dto.js";

@Controller("vaults")
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Post()
  create(@Body() dto: CreateVaultDto) {
    return this.vaultsService.create(dto);
  }

  @Get()
  findAll() {
    return this.vaultsService.findAll();
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.vaultsService.remove(id);
  }
}
