import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateNoteDto } from "./dto/create-note.dto.js";
import { UpdateNoteDto } from "./dto/update-note.dto.js";
import { ReorderNotesDto } from "./dto/reorder-notes.dto.js";
import { NotesService } from "./notes.service.js";

@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.notesService.create(dto);
  }

  @Get()
  findAll(@Query("vaultId") vaultId?: string) {
    return this.notesService.findAll(vaultId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.notesService.findOne(id);
  }

  // Must be before PATCH :id so "reorder" is not treated as an id param
  @Patch("reorder")
  reorder(@Body() dto: ReorderNotesDto) {
    return this.notesService.reorder(dto.items);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.notesService.remove(id);
  }
}
