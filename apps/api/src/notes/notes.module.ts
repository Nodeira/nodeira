import { Module } from "@nestjs/common";
import { MarkdownConverterService } from "./markdown-converter.service.js";
import { NotesController } from "./notes.controller.js";
import { NotesService } from "./notes.service.js";

@Module({
  controllers: [NotesController],
  providers: [NotesService, MarkdownConverterService],
  exports: [NotesService],
})
export class NotesModule {}
