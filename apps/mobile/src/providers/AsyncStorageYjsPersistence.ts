import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Y from 'yjs';
import * as buf from 'lib0/buffer';

const KEY_PREFIX = 'yjs_state_';
const DEBOUNCE_MS = 500;

export class AsyncStorageYjsPersistence {
  private readonly doc: Y.Doc;
  private readonly key: string;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(doc: Y.Doc, noteId: string) {
    this.doc = doc;
    this.key = `${KEY_PREFIX}${noteId}`;
    this.loadAndApply();
    doc.on('update', this.onUpdate);
  }

  private async loadAndApply(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.key);
      if (!stored) return;
      const binary = buf.fromBase64(stored);
      Y.applyUpdate(this.doc, binary);
    } catch (err) {
      console.warn('[AsyncStorageYjsPersistence] failed to load state:', err);
    }
  }

  private onUpdate = (): void => {
    if (this.destroyed) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.persist(), DEBOUNCE_MS);
  };

  private async persist(): Promise<void> {
    if (this.destroyed) return;
    try {
      const update = Y.encodeStateAsUpdate(this.doc);
      const b64 = buf.toBase64(update);
      await AsyncStorage.setItem(this.key, b64);
    } catch (err) {
      console.warn('[AsyncStorageYjsPersistence] failed to persist state:', err);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.doc.off('update', this.onUpdate);
  }
}
