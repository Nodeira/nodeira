import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { CreateNoteDto } from "./dto/create-note.dto.js";
import { UpdateNoteDto } from "./dto/update-note.dto.js";
import { ReorderNotesDto } from "./dto/reorder-notes.dto.js";
import { SetContentDto } from "./dto/set-content.dto.js";
import { NotesService } from "./notes.service.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@UseGuards(JwtAuthGuard)
@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateNoteDto) {
    return this.notesService.create(dto, req.user.vaultScope);
  }

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query("vaultId") vaultId?: string,
    @Query("tag") tag?: string,
  ) {
    return this.notesService.findAll(vaultId, req.user.vaultScope, tag);
  }

  // Must be before :id routes to avoid "graph" being treated as a note id
  @Get("graph")
  getAllLinks(@Request() req: RequestWithUser) {
    return this.notesService.getAllLinks(req.user.vaultScope);
  }

  // Must be before :id routes
  @Get("tags")
  getAllTags(@Request() req: RequestWithUser) {
    return this.notesService.getAllTags(req.user.vaultScope);
  }

  @Get(":id")
  findOne(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.notesService.findOne(id, req.user.vaultScope);
  }

  // Must be before PATCH :id so "reorder" is not treated as an id param
  @Patch("reorder")
  reorder(@Request() req: RequestWithUser, @Body() dto: ReorderNotesDto) {
    return this.notesService.reorder(dto.items, req.user.vaultScope);
  }

  @Patch(":id")
  update(@Request() req: RequestWithUser, @Param("id") id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto, req.user.vaultScope);
  }

  @Delete(":id")
  remove(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.notesService.remove(id, req.user.vaultScope);
  }

  @Get(":id/backlinks")
  getBacklinks(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.notesService.getBacklinks(id, req.user.vaultScope);
  }

  @Get(":id/links")
  getOutLinks(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.notesService.getOutLinks(id, req.user.vaultScope);
  }

  @Get(":id/content")
  getContent(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.notesService.getContent(id, req.user.vaultScope);
  }

  @Put(":id/content")
  setContent(@Request() req: RequestWithUser, @Param("id") id: string, @Body() dto: SetContentDto) {
    return this.notesService.setContent(id, dto.content, req.user.vaultScope);
  }
}
