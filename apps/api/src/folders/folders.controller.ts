import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { FoldersService } from "./folders.service.js";
import { CreateFolderDto } from "./dto/create-folder.dto.js";

@UseGuards(JwtAuthGuard)
@Controller("folders")
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateFolderDto) {
    return this.foldersService.create(req.user.id, dto, req.user.vaultScope);
  }

  @Get()
  findAll(@Request() req: RequestWithUser, @Query("vaultId") vaultId?: string) {
    return this.foldersService.findAll(req.user.id, vaultId, req.user.vaultScope);
  }

  @Patch(":id")
  update(
    @Request() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { icon?: string | null },
  ) {
    return this.foldersService.update(req.user.id, id, body, req.user.vaultScope);
  }

  @Delete(":id")
  remove(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.foldersService.remove(req.user.id, id, req.user.vaultScope);
  }
}
