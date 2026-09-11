import { Mutex } from 'async-mutex';
import { markRaw } from 'vue';

interface CacheMetadata {
  size: number;
  accessedAt: number;
}

interface CacheManifest {
  version: 1;
  totalBytes: number;
  entries: Record<string, CacheMetadata>;
}

const encoder = new TextEncoder();

/**
 * A persistent cache for immutable values.
 *
 * Values and LRU metadata are deliberately stored separately. A hit performs
 * exactly one storage read and never schedules another IndexedDB transaction.
 * Misses update one small manifest, so eviction does not need to enumerate and
 * read every cached value.
 */
export default class SizeAwareLruCache {
  // Model objects are exposed through Vue props and may be deeply proxied.
  // These synchronization primitives are implementation state, not UI state;
  // making the Map reactive creates a computedAsync -> Map mutation loop.
  readonly _inFlight = markRaw(new Map<string, Promise<unknown>>());
  readonly _writeMutex = markRaw(new Mutex());
  readonly _manifestPromise: Promise<CacheManifest>;

  constructor(
    readonly _store: Pick<LocalForage, 'getItem' | 'setItem' | 'removeItem'>,
    readonly _namespace: string,
    readonly _maxBytes: number,
    readonly _now: () => number = Date.now,
  ) {
    this._manifestPromise = this._loadManifest();
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const storageKey = this._storageKey(key);
    const running = this._inFlight.get(storageKey) as Promise<T> | undefined;
    if (running) return running;

    const request = this._readOrLoad(storageKey, load);
    this._inFlight.set(storageKey, request);
    try {
      return await request;
    } finally {
      this._inFlight.delete(storageKey);
    }
  }

  async _readOrLoad<T>(storageKey: string, load: () => Promise<T>): Promise<T> {
    const manifest = await this._manifestPromise;
    try {
      const cached = await this._store.getItem<T>(storageKey);
      if (cached !== null) {
        const metadata = manifest.entries[storageKey];
        if (metadata) metadata.accessedAt = this._now();
        return cached;
      }
    } catch (error) {
      console.warn(`Could not read local cache entry ${storageKey}`, error);
    }

    const value = await load();
    try {
      await this._writeMutex.runExclusive(async () => {
        const previousSize = manifest.entries[storageKey]?.size ?? 0;
        const metadata = {
          size: this._sizeOf(storageKey, value),
          accessedAt: this._now(),
        };

        await this._store.setItem(storageKey, value);
        manifest.entries[storageKey] = metadata;
        manifest.totalBytes += metadata.size - previousSize;
        await this._evict(manifest);
        await this._store.setItem(this._manifestKey, manifest);
      });
    } catch (error) {
      console.warn(`Could not save local cache entry ${storageKey}`, error);
    }
    return value;
  }

  async _loadManifest(): Promise<CacheManifest> {
    try {
      const manifest = await this._store.getItem<CacheManifest>(this._manifestKey);
      if (manifest?.version === 1 && manifest.entries && Number.isFinite(manifest.totalBytes)) {
        return manifest;
      }
    } catch (error) {
      console.warn(`Could not read local cache manifest ${this._manifestKey}`, error);
    }
    return { version: 1, totalBytes: 0, entries: {} };
  }

  async _evict(manifest: CacheManifest): Promise<void> {
    if (manifest.totalBytes <= this._maxBytes) return;

    const oldestFirst = Object.entries(manifest.entries)
      .sort(([, left], [, right]) => left.accessedAt - right.accessedAt);
    for (const [key, metadata] of oldestFirst) {
      if (manifest.totalBytes <= this._maxBytes) break;
      await this._store.removeItem(key);
      delete manifest.entries[key];
      manifest.totalBytes -= metadata.size;
    }
  }

  get _manifestKey(): string {
    return `${this._namespace}:manifest`;
  }

  _storageKey(key: string): string {
    return `${this._namespace}:entry:${key}`;
  }

  _sizeOf(key: string, value: unknown): number {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return encoder.encode(key).byteLength + encoder.encode(serialized).byteLength;
  }
}
