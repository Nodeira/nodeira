export interface Folder {
  id: string;
  name: string;
  vaultId: string | null;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
}
