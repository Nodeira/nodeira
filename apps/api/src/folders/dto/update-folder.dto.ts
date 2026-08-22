import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateFolderDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  name?: string;

  @IsUUID()
  @IsOptional()
  vaultId?: string;

  // undefined = unchanged; null = move to the vault root.
  @IsUUID()
  @IsOptional()
  parentId?: string;

  // Explicitly nullable (unlike name/vaultId/parentId above): clearing a folder's icon
  // back to the default has always been a supported "icon: null" call, predating this
  // DTO — see folders.service.spec.ts's "throws NotFoundException for unknown id" case.
  @IsString()
  @IsOptional()
  icon?: string | null;
}
