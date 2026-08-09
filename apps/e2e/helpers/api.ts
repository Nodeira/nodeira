const API = process.env["API_BASE_URL"] ?? "http://localhost:3001";

/**
 * Every route below is authenticated now that access is decided by vault membership. These
 * helpers previously called the API with no credentials at all, which quietly stopped
 * working when multi-user landed — and went unnoticed because the e2e suite was not part
 * of CI. Credentials come from E2E_EMAIL / E2E_PASSWORD, defaulting to the account the
 * workflow creates through /setup.
 */
const EMAIL = process.env["E2E_EMAIL"] ?? "e2e@example.com";
const PASSWORD = process.env["E2E_PASSWORD"] ?? "e2e-password-123";

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(
      `Could not log in as ${EMAIL} (status ${res.status}). ` +
        "Run first-time setup, or set E2E_EMAIL / E2E_PASSWORD.",
    );
  }
  const body = (await res.json()) as { access_token: string };
  cachedToken = body.access_token;
  return cachedToken;
}

/** The raw login response, for seeding the browser's session. */
export async function getSession(): Promise<{ token: string; user: unknown }> {
  const token = await getToken();
  const res = await fetch(`${API}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not fetch profile (status ${res.status})`);
  return { token, user: await res.json() };
}

/** The first vault the e2e account can see; content has to live in one. */
export async function getPrimaryVaultId(): Promise<string> {
  const vaults = await getVaults();
  const first = vaults[0];
  if (!first) throw new Error(`The ${EMAIL} account has no vault`);
  return first.id;
}

export interface Vault {
  id: string;
  name: string;
}
export interface Folder {
  id: string;
  name: string;
  vaultId: string;
}
export interface Note {
  id: string;
  title: string;
  type: "note" | "quick";
  vaultId: string;
  folderId: string | null;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as object),
    },
  });
  if (!res.ok) throw new Error(`API ${init.method ?? "GET"} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const getVaults = () => req<Vault[]>("/vaults");
export const createVault = (name: string) =>
  req<Vault>("/vaults", { method: "POST", body: JSON.stringify({ name }) });
export const deleteVault = (id: string) => req<void>(`/vaults/${id}`, { method: "DELETE" });
export const createFolder = (name: string, vaultId: string) =>
  req<Folder>("/folders", { method: "POST", body: JSON.stringify({ name, vaultId }) });
export const deleteFolder = (id: string) => req<void>(`/folders/${id}`, { method: "DELETE" });
export const getNotes = (vaultId?: string) =>
  req<Note[]>(vaultId ? `/notes?vaultId=${vaultId}` : "/notes");
export const createNote = (body: {
  title?: string;
  type?: "note" | "quick";
  /** Required: content cannot exist outside a vault. */
  vaultId: string;
  folderId?: string;
}) => req<Note>("/notes", { method: "POST", body: JSON.stringify(body) });
export const deleteNote = (id: string) => req<void>(`/notes/${id}`, { method: "DELETE" });
