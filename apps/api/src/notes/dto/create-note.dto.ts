import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateNoteDto {
  /**
   * Client-chosen id, so a note can exist before the server has heard of it.
   *
   * The Android app creates notes offline and replays them when it reconnects. The editor
   * keys its Yjs document by note id, so a server-assigned id would orphan whatever was
   * typed into the note before it synced. Supplying the id up front also makes create
   * idempotent: replaying a queued create whose response was lost returns the existing note
   * instead of a duplicate.
   */
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  title?: string;

  @IsEnum(["note", "quick"])
  @IsOptional()
  type?: "note" | "quick";

  // Required now: a note with no vault is a note no membership can authorize.
  @IsUUID()
  vaultId!: string;

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
