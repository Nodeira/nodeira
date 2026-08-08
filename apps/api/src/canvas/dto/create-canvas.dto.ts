import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCanvasDto {
  @ApiPropertyOptional({ description: "Canvas title", minLength: 1 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ description: "UUID of the vault to place the canvas in" })
  // Required now: a canvas with no vault is a canvas no membership can authorize.
  @IsUUID()
  vaultId!: string;

  @ApiPropertyOptional({ description: "UUID of the folder to place the canvas in" })
  @IsUUID()
  @IsOptional()
  folderId?: string;
}
