import localforage from 'localforage';
import SizeAwareLruCache from './SizeAwareLruCache';

const MAX_GIT_OBJECT_BYTES = 25 * 1024 * 1024;
const storage = localforage.createInstance({
  name: 'humperdinck',
  storeName: 'github_objects_v2',
});

export default class GitObjectCache {
  readonly _cache: SizeAwareLruCache;

  constructor(userId: string) {
    this._cache = new SizeAwareLruCache(storage, `user:${userId}`, MAX_GIT_OBJECT_BYTES);
  }

  blob<T>(repoId: number, sha: string, load: () => Promise<T>): Promise<T> {
    return this._cache.getOrLoad(`repo:${repoId}:blob:${sha}`, load);
  }

  tree<T>(repoId: number, sha: string, load: () => Promise<T>): Promise<T> {
    return this._cache.getOrLoad(`repo:${repoId}:tree:${sha}`, load);
  }

  commitPage<T>(repoId: number, headSha: string, page: number, load: () => Promise<T>): Promise<T> {
    return this._cache.getOrLoad(`repo:${repoId}:commits:${headSha}:page:${page}`, load);
  }
}
