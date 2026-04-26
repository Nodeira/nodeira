import { IsString, MinLength } from "class-validator";

export class CreateVaultDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
