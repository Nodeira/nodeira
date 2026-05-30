import { HocuspocusProvider } from '@hocuspocus/provider';
import { AppState, type AppStateStatus } from 'react-native';
import * as Y from 'yjs';

import { getToken } from '@/lib/auth';
import { getWsUrl } from '@/lib/config';
import { AsyncStorageYjsPersistence } from './AsyncStorageYjsPersistence';

export interface YjsContext {
  doc: Y.Doc;
  persistence: AsyncStorageYjsPersistence;
  wsProvider: HocuspocusProvider;
}

const cache = new Map<string, YjsContext>();

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function initAppStateListener(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    for (const ctx of cache.values()) {
      if (state === 'active') {
        ctx.wsProvider.connect();
      } else if (state === 'background') {
        ctx.wsProvider.disconnect();
      }
    }
  });
}

export function getYjsContext(noteId: string): YjsContext {
  initAppStateListener();

  const existing = cache.get(noteId);
  if (existing) return existing;

  const doc = new Y.Doc();
  const persistence = new AsyncStorageYjsPersistence(doc, noteId);
  const wsProvider = new HocuspocusProvider({
    url: `${getWsUrl()}/sync`,
    name: noteId,
    document: doc,
    token: () => getToken().then((t) => t ?? ""),
  });

  const ctx: YjsContext = { doc, persistence, wsProvider };
  cache.set(noteId, ctx);
  return ctx;
}

export function releaseYjsContext(noteId: string): void {
  const ctx = cache.get(noteId);
  if (!ctx) return;
  ctx.wsProvider.destroy();
  ctx.persistence.destroy();
  cache.delete(noteId);
}
