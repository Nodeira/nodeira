export type NoteType = "note" | "quick";

export interface Note {
  id: string;
  title: string;
  type: NoteType;
  kind: string | null;
  kindMeta: Record<string, unknown> | null;
  vaultId: string | null;
  folderId: string | null;
  pinned: boolean;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  position: number;
}

export interface NoteLink {
  sourceId: string;
  targetId: string;
  label?: string;
}

export type NoteMetadata = Pick<
  Note,
  | "id"
  | "title"
  | "type"
  | "kind"
  | "kindMeta"
  | "vaultId"
  | "folderId"
  | "pinned"
  | "icon"
  | "tags"
  | "createdAt"
  | "updatedAt"
  | "position"
> & {
  preview?: string;
};
