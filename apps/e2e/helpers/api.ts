const API = process.env["API_BASE_URL"] ?? "http://localhost:3001";

export interface Vault {
  id: string;
  name: string;
}
export interface Folder {
  id: string;
  name: string;
  vaultId: string | null;
}
export interface Note {
  id: string;
  title: string;
  type: "note" | "quick";
  vaultId: string | null;
  folderId: string | null;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers as object) },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${init.method ?? "GET"} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const getVaults = () => req<Vault[]>("/vaults");
export const createVault = (name: string) =>
  req<Vault>("/vaults", { method: "POST", body: JSON.stringify({ name }) });
export const deleteVault = (id: string) => req<void>(`/vaults/${id}`, { method: "DELETE" });
export const createFolder = (name: string, vaultId?: string) =>
  req<Folder>("/folders", { method: "POST", body: JSON.stringify({ name, vaultId }) });
export const deleteFolder = (id: string) => req<void>(`/folders/${id}`, { method: "DELETE" });
export const getNotes = (vaultId?: string) =>
  req<Note[]>(vaultId ? `/notes?vaultId=${vaultId}` : "/notes");
export const createNote = (body: {
  title?: string;
  type?: "note" | "quick";
  vaultId?: string;
  folderId?: string;
}) => req<Note>("/notes", { method: "POST", body: JSON.stringify(body) });
export const deleteNote = (id: string) => req<void>(`/notes/${id}`, { method: "DELETE" });
