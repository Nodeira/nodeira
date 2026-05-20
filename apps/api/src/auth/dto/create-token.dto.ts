import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateTokenDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  vaultId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
