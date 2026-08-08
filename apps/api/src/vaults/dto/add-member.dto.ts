import { IsEnum, IsUUID } from "class-validator";
import { VaultRole } from "@prisma/client";

export class AddVaultMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(VaultRole)
  role!: VaultRole;
}
