import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateNoteDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  title?: string;

  @IsEnum(["note", "quick"])
  @IsOptional()
  type?: "note" | "quick";

  @IsUUID()
  @IsOptional()
  vaultId?: string;

  @IsUUID()
  @IsOptional()
  folderId?: string;

  @IsInt()
  @IsOptional()
  position?: number;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  kind?: string;

  @IsObject()
  @IsOptional()
  kindMeta?: Record<string, unknown>;
}
