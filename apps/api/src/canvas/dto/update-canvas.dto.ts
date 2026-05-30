import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCanvasDto {
  @ApiPropertyOptional({ description: "Canvas title", minLength: 1 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  title?: string;

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
