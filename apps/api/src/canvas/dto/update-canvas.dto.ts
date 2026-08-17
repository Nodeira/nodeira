import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCanvasDto {
  @ApiPropertyOptional({ description: "Canvas title", minLength: 1 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ description: "UUID of the vault to move the canvas into" })
  @IsUUID()
  @IsOptional()
  vaultId?: string;

  // IsOptional() short-circuits the rest for null too, not just undefined — that's what
  // lets a client send `folderId: null` to un-file a canvas back to the vault root.
  @ApiPropertyOptional({
    description: "UUID of the folder to move the canvas into, or null to un-file it",
  })
  @IsUUID()
  @IsOptional()
  folderId?: string | null;

  @ApiPropertyOptional({ description: "Full canvas JSON data (nodes and edges)" })
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Whether the canvas is pinned" })
  @IsBoolean()
  @IsOptional()
  pinned?: boolean;

  @ApiPropertyOptional({ description: "Emoji or character icon for the canvas" })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: "Display position in the canvas list" })
  @IsInt()
  @IsOptional()
  position?: number;
}
