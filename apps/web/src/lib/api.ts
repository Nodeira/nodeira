import type {
  Canvas,
  CanvasData,
  Device,
  Folder,
  NoteMetadata,
  NoteType,
  OgPreview,
  PluginRecord,
  Reminder,
  Vault,
} from "@nodeira/shared-types";
import { authStorage } from "./authStorage.js";
import { getApiBaseUrl } from "./serverConfig.js";
import { router } from "../router.js";
import "./electronAPI.js";

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
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers });

  if (res.status === 401) {
    authStorage.clear();
    // Navigate via the router, not window.location: under Electron the app runs
    // on memory history from a file:// origin, so window.location.pathname is the
    // disk path (never "/login") and assigning window.location.href would try to
    // load file:///<drive>/login. router.navigate works for both histories.
    if (router.state.location.pathname !== "/login") {
      void router.navigate({ to: "/login" });
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`API ${init.method ?? "GET"} ${path} failed: ${res.status}`);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export async function login(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthResponse> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe }),
  });
  if (!res.ok) throw new Error("Invalid email or password");
  return res.json() as Promise<AuthResponse>;
}

export async function getSetupStatus(): Promise<{ setupRequired: boolean }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/v1/setup/status`);
  if (!res.ok) throw new Error("Failed to fetch setup status");
  return res.json() as Promise<{ setupRequired: boolean }>;
}

export async function createAdmin(data: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/v1/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Setup failed");
  }
  return res.json() as Promise<AuthResponse>;
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

export const backlinksKeys = {
  forNote: (noteId: string) => ["backlinks", noteId] as const,
};

export const linksKeys = {
  forNote: (noteId: string) => ["links", noteId] as const,
};

export const graphKeys = {
  all: ["graph"] as const,
};

export const tagsKeys = {
  all: ["tags"] as const,
  forTag: (tag: string) => ["tags", "notes", tag] as const,
};

export async function getNotes(vaultId?: string): Promise<NoteMetadata[]> {
  const path = vaultId ? `/notes?vaultId=${vaultId}` : "/notes";
  const raw = await request<RawNoteMetadata[]>(path);
  return raw.map(parseNote);
}

export async function getTags(): Promise<{ tag: string; count: number }[]> {
  return request<{ tag: string; count: number }[]>("/notes/tags");
}

export async function getNotesByTag(tag: string): Promise<NoteMetadata[]> {
  const raw = await request<RawNoteMetadata[]>(`/notes?tag=${encodeURIComponent(tag)}`);
  return raw.map(parseNote);
}

export async function getNote(id: string): Promise<NoteMetadata> {
  const raw = await request<RawNoteMetadata>(`/notes/${id}`);
  return parseNote(raw);
}

export async function getNoteContent(id: string): Promise<string> {
  const res = await request<{ content: string }>(`/notes/${id}/content`);
  return res.content;
}

export async function createNote(body: {
  type: NoteType;
  vaultId?: string;
  folderId?: string;
  title?: string;
  kind?: string;
  kindMeta?: Record<string, unknown>;
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

export async function moveNote(
  id: string,
  body: { folderId?: string | null; vaultId?: string | null },
): Promise<void> {
  await request(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
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

export async function getBacklinks(noteId: string): Promise<NoteMetadata[]> {
  const raw = await request<RawNoteMetadata[]>(`/notes/${noteId}/backlinks`);
  return raw.map(parseNote);
}

export async function getOutLinks(noteId: string): Promise<NoteMetadata[]> {
  const raw = await request<RawNoteMetadata[]>(`/notes/${noteId}/links`);
  return raw.map(parseNote);
}

export async function getAllLinks(): Promise<{ sourceId: string; targetId: string }[]> {
  return request<{ sourceId: string; targetId: string }[]>("/notes/graph");
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

export async function createFolder(
  name: string,
  vaultId?: string,
  parentId?: string,
): Promise<Folder> {
  const raw = await request<RawFolder>("/folders", {
    method: "POST",
    body: JSON.stringify({ name, vaultId, parentId }),
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

// ── App State ─────────────────────────────────────────────────────────────────

export interface AppState {
  openTabs: string[];
  activeNoteId: string | null;
}

export const appStateKeys = {
  all: ["appState"] as const,
};

export async function getAppState(): Promise<AppState> {
  return request<AppState>("/app-state");
}

export async function patchAppState(data: Partial<AppState>): Promise<void> {
  await request("/app-state", { method: "PATCH", body: JSON.stringify(data) });
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ url: string }>("/upload", { method: "POST", body: form });
}

export async function uploadPdf(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ url: string }>("/upload", { method: "POST", body: form });
}

// ── User Preferences ──────────────────────────────────────────────────────────

export interface UserPreferences {
  startupView?: string;
}

export const userPreferencesKeys = {
  me: ["userPreferences"] as const,
};

export async function getUserPreferences(): Promise<UserPreferences> {
  return request<UserPreferences>("/users/me/preferences");
}

export async function patchUserPreferences(
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  return request<UserPreferences>("/users/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ── Plugins ───────────────────────────────────────────────────────────────────

type RawPluginRecord = Omit<PluginRecord, "installedAt" | "updatedAt"> & {
  installedAt: string;
  updatedAt: string;
};

function parsePlugin(raw: RawPluginRecord): PluginRecord {
  return { ...raw, installedAt: new Date(raw.installedAt), updatedAt: new Date(raw.updatedAt) };
}

export const pluginsKeys = {
  all: ["plugins"] as const,
};

export async function getPlugins(): Promise<PluginRecord[]> {
  const raw = await request<RawPluginRecord[]>("/plugins");
  return raw.map(parsePlugin);
}

export async function installPlugin(source: string): Promise<PluginRecord> {
  const raw = await request<RawPluginRecord>("/plugins", {
    method: "POST",
    body: JSON.stringify({ source }),
  });
  return parsePlugin(raw);
}

export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<PluginRecord> {
  const raw = await request<RawPluginRecord>(`/plugins/${pluginId}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return parsePlugin(raw);
}

export async function uninstallPlugin(pluginId: string): Promise<void> {
  await request(`/plugins/${pluginId}`, { method: "DELETE" });
}

// ── Canvases ──────────────────────────────────────────────────────────────────

type RawCanvas = Omit<Canvas, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function parseCanvas(raw: RawCanvas): Canvas {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export const canvasKeys = {
  all: ["canvases"] as const,
  search: (q: string) => ["canvases", "search", q] as const,
  byVault: (vaultId: string) => ["canvases", "vault", vaultId] as const,
  detail: (id: string) => ["canvases", id] as const,
};

export async function getCanvases(params?: { vaultId?: string; q?: string }): Promise<Canvas[]> {
  const search = new URLSearchParams();
  if (params?.vaultId) search.set("vaultId", params.vaultId);
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  const raw = await request<RawCanvas[]>(`/canvases${qs ? `?${qs}` : ""}`);
  return raw.map(parseCanvas);
}

export async function getCanvas(id: string): Promise<Canvas> {
  const raw = await request<RawCanvas>(`/canvases/${id}`);
  return parseCanvas(raw);
}

export async function createCanvas(body: {
  title?: string;
  vaultId?: string;
  folderId?: string;
}): Promise<Canvas> {
  const raw = await request<RawCanvas>("/canvases", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return parseCanvas(raw);
}

export async function updateCanvas(
  id: string,
  body: { title?: string; data?: CanvasData; pinned?: boolean; icon?: string | null },
): Promise<Canvas> {
  const raw = await request<RawCanvas>(`/canvases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return parseCanvas(raw);
}

export async function deleteCanvas(id: string): Promise<void> {
  await request(`/canvases/${id}`, { method: "DELETE" });
}

export async function fetchUrlPreview(url: string): Promise<OgPreview> {
  return request<OgPreview>("/canvases/preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// ── Reminders ─────────────────────────────────────────────────────────────────

type RawReminder = Omit<
  Reminder,
  "fireAt" | "snoozeUntil" | "lastFiredAt" | "createdAt" | "updatedAt"
> & {
  fireAt: string | null;
  snoozeUntil: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseReminder(raw: RawReminder): Reminder {
  return {
    ...raw,
    fireAt: raw.fireAt ? new Date(raw.fireAt) : null,
    snoozeUntil: raw.snoozeUntil ? new Date(raw.snoozeUntil) : null,
    lastFiredAt: raw.lastFiredAt ? new Date(raw.lastFiredAt) : null,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export const remindersKeys = {
  all: ["reminders"] as const,
};

export interface CreateReminderBody {
  title: string;
  body?: string;
  targetType?: Reminder["targetType"];
  targetNoteId?: string;
  targetCanvasId?: string;
  targetNodeId?: string;
  triggerType: Reminder["triggerType"];
  fireAt?: string; // ISO
  timezone?: string;
  recurrence?: Reminder["recurrence"];
  lat?: number;
  lng?: number;
  radiusM?: number;
  locationName?: string;
  onLeave?: boolean;
}

export async function getReminders(): Promise<Reminder[]> {
  const raw = await request<RawReminder[]>("/reminders");
  return raw.map(parseReminder);
}

export async function createReminder(body: CreateReminderBody): Promise<Reminder> {
  const raw = await request<RawReminder>("/reminders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return parseReminder(raw);
}

export async function updateReminder(
  id: string,
  body: Partial<CreateReminderBody>,
): Promise<Reminder> {
  const raw = await request<RawReminder>(`/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return parseReminder(raw);
}

export async function snoozeReminder(id: string, until: string): Promise<Reminder> {
  const raw = await request<RawReminder>(`/reminders/${id}/snooze`, {
    method: "POST",
    body: JSON.stringify({ until }),
  });
  return parseReminder(raw);
}

export async function dismissReminder(id: string): Promise<Reminder> {
  const raw = await request<RawReminder>(`/reminders/${id}/dismiss`, { method: "POST" });
  return parseReminder(raw);
}

export async function deleteReminder(id: string): Promise<void> {
  await request(`/reminders/${id}`, { method: "DELETE" });
}

// ── Devices (push / WS clients) ───────────────────────────────────────────────

export async function registerDevice(body: {
  platform: Device["platform"];
  pushToken?: string;
  name?: string;
}): Promise<Device> {
  return request<Device>("/devices", { method: "POST", body: JSON.stringify(body) });
}
