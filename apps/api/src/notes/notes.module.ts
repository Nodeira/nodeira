import { Module } from "@nestjs/common";
import { TrashModule } from "../trash/trash.module.js";
import { MarkdownConverterService } from "./markdown-converter.service.js";
import { NotesController } from "./notes.controller.js";
import { NotesService } from "./notes.service.js";

@Module({
  imports: [TrashModule],
  controllers: [NotesController],
  providers: [NotesService, MarkdownConverterService],
  exports: [NotesService],
})
export class NotesModule {}
