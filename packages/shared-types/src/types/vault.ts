export interface Vault {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Access level within a single vault. Mirrors the VaultRole enum in the Prisma schema. */
export type VaultRole = "OWNER" | "EDITOR" | "VIEWER";

export interface VaultMember {
  role: VaultRole;
  createdAt: Date;
  user: { id: string; email: string; name: string | null };
}

/** Instance-wide role. Distinct from VaultRole, which is per vault. */
export type UserRole = "ADMIN" | "USER";

export interface DirectoryUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
}
