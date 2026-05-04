import { IsString, MinLength } from "class-validator";

export class InstallPluginDto {
  @IsString()
  @MinLength(1)
  source!: string;
}
