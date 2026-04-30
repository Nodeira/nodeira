import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsUUID, ValidateNested } from "class-validator";

export class ReorderNoteItemDto {
  @IsUUID()
  id!: string;

  @IsInt()
  position!: number;

  @IsUUID()
  @IsOptional()
  folderId?: string | null;
}

export class ReorderNotesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderNoteItemDto)
  items!: ReorderNoteItemDto[];
}
