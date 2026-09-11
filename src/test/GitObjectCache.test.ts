import { describe, expect, it, vi } from 'vitest';
import GitObjectCache from '@/cache/GitObjectCache';

describe('GitObjectCache', () => {
  it('keys associated pull requests by repository and immutable commit SHA', async () => {
    const getOrLoad = vi.fn(async (_key: string, load: () => Promise<unknown>) => load());
    const cache = Object.create(GitObjectCache.prototype) as GitObjectCache;
    Object.defineProperty(cache, '_cache', { value: { getOrLoad } });
    const load = vi.fn(async () => [{ number: 42 }]);

    await expect(cache.associatedPullRequests(7, 'commit-sha', load))
      .resolves.toEqual([{ number: 42 }]);
    expect(getOrLoad).toHaveBeenCalledWith(
      'repo:7:commit:commit-sha:pull-requests',
      load,
    );
    expect(load).toHaveBeenCalledOnce();
  });
});
