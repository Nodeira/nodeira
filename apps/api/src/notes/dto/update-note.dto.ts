import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateNoteDto } from "./create-note.dto.js";

/**
 * `tags` is omitted deliberately. Tags are derived from the hashTag nodes in the note's
 * document and rewritten by NotesService.syncTags on every sync flush, so a value sent
 * here was silently overwritten moments later. With forbidNonWhitelisted the field is now
 * rejected outright instead of appearing to work. No client sends it.
 */
export class UpdateNoteDto extends PartialType(OmitType(CreateNoteDto, ["tags"] as const)) {}
