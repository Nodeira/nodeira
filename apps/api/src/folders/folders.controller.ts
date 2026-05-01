import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { FoldersService } from "./folders.service.js";
import { CreateFolderDto } from "./dto/create-folder.dto.js";

@Controller("folders")
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@Body() dto: CreateFolderDto) {
    return this.foldersService.create(dto);
  }

  @Get()
  findAll(@Query("vaultId") vaultId?: string) {
    return this.foldersService.findAll(vaultId);
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
