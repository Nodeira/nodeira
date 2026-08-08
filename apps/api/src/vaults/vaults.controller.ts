import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { VaultsService } from "./vaults.service.js";
import { CreateVaultDto } from "./dto/create-vault.dto.js";
import { AddVaultMemberDto } from "./dto/add-member.dto.js";

@UseGuards(JwtAuthGuard)
@Controller("vaults")
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateVaultDto) {
    return this.vaultsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.vaultsService.findAll(req.user.id, req.user.vaultScope);
  }

  @Delete(":id")
  remove(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.vaultsService.remove(req.user.id, id, req.user.vaultScope);
  }

  // ── Sharing ────────────────────────────────────────────────────────────────

  @Get(":id/members")
  listMembers(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.vaultsService.listMembers(req.user.id, id, req.user.vaultScope);
  }

  @Post(":id/members")
  addMember(
    @Request() req: RequestWithUser,
    @Param("id") id: string,
    @Body() dto: AddVaultMemberDto,
  ) {
    return this.vaultsService.addMember(req.user.id, id, dto.userId, dto.role, req.user.vaultScope);
  }

  @Delete(":id/members/:userId")
  removeMember(
    @Request() req: RequestWithUser,
    @Param("id") id: string,
    @Param("userId") targetUserId: string,
  ) {
    return this.vaultsService.removeMember(req.user.id, id, targetUserId, req.user.vaultScope);
  }
}
