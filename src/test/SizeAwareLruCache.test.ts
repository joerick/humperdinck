import { describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { computedAsync } from '@vueuse/core';
import SizeAwareLruCache from '@/cache/SizeAwareLruCache';

class MemoryStore {
  readonly values = new Map<string, unknown>();
  getCount = 0;
  setCount = 0;
  removeCount = 0;

  async getItem<T>(key: string): Promise<T | null> {
    this.getCount += 1;
    return this.values.get(key) as T ?? null;
  }

  async setItem<T>(key: string, value: T): Promise<T> {
    this.setCount += 1;
    this.values.set(key, value);
    return value;
  }

  async removeItem(key: string): Promise<void> {
    this.removeCount += 1;
    this.values.delete(key);
  }
}

describe('SizeAwareLruCache', () => {
  it('reuses persisted values and coalesces concurrent loads', async () => {
    const store = new MemoryStore();
    const cache = new SizeAwareLruCache(store, 'test', 1_000);
    const load = vi.fn(async () => 'contents');

    await expect(Promise.all([
      cache.getOrLoad('blob:abc', load),
      cache.getOrLoad('blob:abc', load),
    ])).resolves.toEqual(['contents', 'contents']);
    await expect(cache.getOrLoad('blob:abc', load)).resolves.toBe('contents');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a storage write after a cache hit', async () => {
    const store = new MemoryStore();
    const cache = new SizeAwareLruCache(store, 'test', 1_000);

    await cache.getOrLoad('blob:abc', async () => 'contents');
    const writesAfterMiss = store.setCount;
    const readsAfterMiss = store.getCount;

    await expect(cache.getOrLoad('blob:abc', async () => 'not loaded')).resolves.toBe('contents');
    expect(store.getCount).toBe(readsAfterMiss + 1);
    expect(store.setCount).toBe(writesAfterMiss);
    expect(store.removeCount).toBe(0);
  });

  it('does not retrigger an async computation when Vue proxies the cache', async () => {
    const store = new MemoryStore();
    const cache = reactive(new SizeAwareLruCache(store, 'test', 1_000));
    const load = vi.fn(async () => 'contents');
    let evaluations = 0;

    const value = computedAsync(async () => {
      evaluations += 1;
      return cache.getOrLoad('blob:abc', load);
    }, '');

    await vi.waitFor(() => expect(value.value).toBe('contents'));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(evaluations).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('evicts the least recently used values by serialized byte size', async () => {
    const store = new MemoryStore();
    let now = 0;
    const cache = new SizeAwareLruCache(store, 'test', 50, () => ++now);

    await cache.getOrLoad('one', async () => '1111111111');
    await cache.getOrLoad('two', async () => '2222222222');
    await cache.getOrLoad('one', async () => 'not loaded');
    await cache.getOrLoad('three', async () => '3333333333');

    expect(store.values.has('test:entry:one')).toBe(true);
    expect(store.values.has('test:entry:two')).toBe(false);
    expect(store.values.has('test:entry:three')).toBe(true);
  });
});
