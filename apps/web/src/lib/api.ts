import type { Folder, NoteMetadata, NoteType, Vault } from "@nodeira/shared-types";

// ── Raw API shapes (dates come back as strings) ───────────────────────────────

type RawNoteMetadata = Omit<NoteMetadata, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type RawFolder = Omit<Folder, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type RawVault = Omit<Vault, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

// ── Base client ───────────────────────────────────────────────────────────────
// Auth headers will be injected here when authentication is added.

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    // Authorization: `Bearer ${getToken()}`,   ← add when auth is ready
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`/api/v1${path}`, { ...init, headers });

  if (!res.ok) {
    throw new Error(`API ${init.method ?? "GET"} ${path} failed: ${res.status}`);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseNote(raw: RawNoteMetadata): NoteMetadata {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function parseFolder(raw: RawFolder): Folder {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function parseVault(raw: RawVault): Vault {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export const notesKeys = {
  all: ["notes"] as const,
  byVault: (vaultId: string) => ["notes", "vault", vaultId] as const,
  detail: (id: string) => ["notes", id] as const,
};

export async function getNotes(vaultId?: string): Promise<NoteMetadata[]> {
  const path = vaultId ? `/notes?vaultId=${vaultId}` : "/notes";
  const raw = await request<RawNoteMetadata[]>(path);
  return raw.map(parseNote);
}

export async function getNote(id: string): Promise<NoteMetadata> {
  const raw = await request<RawNoteMetadata>(`/notes/${id}`);
  return parseNote(raw);
}

export async function createNote(body: {
  type: NoteType;
  vaultId?: string;
  folderId?: string;
  title?: string;
}): Promise<NoteMetadata> {
  const raw = await request<RawNoteMetadata>("/notes", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return parseNote(raw);
}

export async function updateNoteTitle(
  id: string,
  title: string,
): Promise<Pick<NoteMetadata, "title" | "updatedAt">> {
  const raw = await request<{ title: string; updatedAt: string }>(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  return { title: raw.title, updatedAt: new Date(raw.updatedAt) };
}

export async function updateNotePin(id: string, pinned: boolean): Promise<void> {
  await request(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

export async function updateNoteIcon(id: string, icon: string | null): Promise<void> {
  await request(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ icon }),
  });
}

export async function updateNoteKind(
  id: string,
  kind: string | null,
  kindMeta: Record<string, unknown> | null,
): Promise<void> {
  await request(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ kind, kindMeta }),
  });
}

export async function updateFolderIcon(id: string, icon: string | null): Promise<void> {
  await request(`/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ icon }),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await request(`/notes/${id}`, { method: "DELETE" });
}

export async function reorderNotes(
  items: { id: string; position: number; folderId: string | null }[],
): Promise<void> {
  await request("/notes/reorder", {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

// ── Folders ───────────────────────────────────────────────────────────────────

export const foldersKeys = {
  all: ["folders"] as const,
  byVault: (vaultId: string) => ["folders", "vault", vaultId] as const,
};

export async function getFolders(vaultId?: string): Promise<Folder[]> {
  const path = vaultId ? `/folders?vaultId=${vaultId}` : "/folders";
  const raw = await request<RawFolder[]>(path);
  return raw.map(parseFolder);
}

export async function createFolder(name: string, vaultId?: string): Promise<Folder> {
  const raw = await request<RawFolder>("/folders", {
    method: "POST",
    body: JSON.stringify({ name, vaultId }),
  });
  return parseFolder(raw);
}

// ── Vaults ────────────────────────────────────────────────────────────────────

export const vaultsKeys = {
  all: ["vaults"] as const,
};

export async function getVaults(): Promise<Vault[]> {
  const raw = await request<RawVault[]>("/vaults");
  return raw.map(parseVault);
}

export async function createVault(name: string): Promise<Vault> {
  const raw = await request<RawVault>("/vaults", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return parseVault(raw);
}

export async function deleteVault(id: string): Promise<void> {
  await request(`/vaults/${id}`, { method: "DELETE" });
}

export async function deleteFolder(id: string): Promise<void> {
  await request(`/folders/${id}`, { method: "DELETE" });
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ url: string }>("/upload", { method: "POST", body: form });
}
