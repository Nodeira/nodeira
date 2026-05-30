import type { Canvas, CanvasData, OgPreview } from '@nodeira/shared-types';
import { getToken } from './auth';
import { getApiUrl } from './config';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${getApiUrl()}/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadImage(uri: string): Promise<{ url: string }> {
  const token = await getToken();
  const form = new FormData();
  const filename = uri.split('/').pop() ?? 'photo.jpg';
  form.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
  const res = await fetch(`${getApiUrl()}/api/v1/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${await res.text()}`);
  return res.json() as Promise<{ url: string }>;
}

// Canvas query keys
export const canvasKeys = {
  all: ['canvases'] as const,
  detail: (id: string) => ['canvases', id] as const,
};

// Raw canvas type for date parsing
interface RawCanvas extends Omit<Canvas, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

function parseCanvas(raw: RawCanvas): Canvas {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export async function getCanvases(vaultId?: string | null): Promise<Canvas[]> {
  const path = vaultId ? `/canvases?vaultId=${vaultId}` : '/canvases';
  const raw = await apiFetch<RawCanvas[]>(path);
  return raw.map(parseCanvas);
}

export async function getCanvas(id: string): Promise<Canvas> {
  const raw = await apiFetch<RawCanvas>(`/canvases/${id}`);
  return parseCanvas(raw);
}

export async function createCanvas(body: { title?: string; vaultId?: string | null }): Promise<Canvas> {
  const raw = await apiFetch<RawCanvas>('/canvases', { method: 'POST', body: JSON.stringify(body) });
  return parseCanvas(raw);
}

export async function updateCanvas(id: string, body: { title?: string; data?: CanvasData }): Promise<Canvas> {
  const raw = await apiFetch<RawCanvas>(`/canvases/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  return parseCanvas(raw);
}

export async function deleteCanvas(id: string): Promise<void> {
  await apiFetch<void>(`/canvases/${id}`, { method: 'DELETE' });
}

export async function fetchUrlPreview(url: string): Promise<OgPreview> {
  return apiFetch<OgPreview>('/canvases/preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function getNoteLinks(): Promise<{ sourceId: string; targetId: string }[]> {
  return apiFetch('/notes/graph');
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
