import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // Required now: a folder with no vault is a folder no membership can authorize.
  @IsUUID()
  vaultId!: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}
