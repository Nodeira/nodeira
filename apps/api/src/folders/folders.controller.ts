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
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { FoldersService } from "./folders.service.js";
import { CreateFolderDto } from "./dto/create-folder.dto.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@UseGuards(JwtAuthGuard)
@Controller("folders")
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@Body() dto: CreateFolderDto) {
    return this.foldersService.create(dto);
  }

  @Get()
  findAll(@Request() req: RequestWithUser, @Query("vaultId") vaultId?: string) {
    return this.foldersService.findAll(vaultId, req.user.vaultScope);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { icon?: string | null }) {
    return this.foldersService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.foldersService.remove(id);
  }
}
