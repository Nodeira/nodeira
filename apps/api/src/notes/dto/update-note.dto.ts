import { PartialType } from "@nestjs/mapped-types";
import { CreateNoteDto } from "./create-note.dto.js";

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
