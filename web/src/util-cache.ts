// borrowed from https://github.com/xujif/ts-cache-decorator, with 
// the redis references removed.
// ISC license, some copyright @xujif

export interface CacheStore {
    forever (key: string, value: any): Promise<void>
    set (key: string, ttl: number, value: any): Promise<void>
    get<T>(key: string): Promise<T | undefined>
    delete (key: string): Promise<boolean>
    has (key: string): Promise<boolean>
}

export interface CachePayload {
    data: any,
    expireAt: number
}

export class MemoryCacheStore implements CacheStore {
    protected cache = new Map<string, CachePayload>()

    async forever (key: string, value: any): Promise<void> {
        this.cache.set(key, {
            expireAt: 0,
            data: value
        })
    }

    async set (key: string, ttl: number, value: any): Promise<void> {
        this.cache.set(key, {
            expireAt: this.getTimestamp() + ttl,
            data: value
        })
    }

    async get<T>(key: string): Promise<T | undefined> {
        if (this.cache.has(key)) {
            const payload = this.cache.get(key)!
            if (payload.expireAt < this.getTimestamp()) {
                this.cache.delete(key)
                return
            }
            return payload.data
        } else {
            return
        }
    }

    async delete (key: string): Promise<boolean> {
        return this.cache.delete(key)
    }

    async has (key: string): Promise<boolean> {
        const payload = this.cache.get(key)
        if (!payload) {
            return false
        }
        if (payload.expireAt > 0 && payload.expireAt < this.getTimestamp()) {
            this.cache.delete(key)
            return false
        }
        return true
    }

    protected getTimestamp () {
        return (new Date).getTime() / 1000
    }
}

let cacheStore: CacheStore = new MemoryCacheStore()

const ID_SYMBOL = '__UTIL_CACHE_OBJECT_ID__'
let OBJECT_ID = 1

export interface MemoizeOption {
    ttl: number
    key?: (objId: string, methodName: string, args: any[]) => string
}

export function cacheMethod (opt: MemoizeOption, store?: CacheStore) {
    return function (target: any, method: string, descriptor: TypedPropertyDescriptor<any>) {
        if (!target[ID_SYMBOL]) {
            target[ID_SYMBOL] = OBJECT_ID++
        }
        const objId = target[ID_SYMBOL]
        const usedCacheStore = store || cacheStore
        if (!descriptor.value) {
            throw new Error('decorator only support method')
        }
        const orginMethod = descriptor.value
        descriptor.value = async function (...args: any[]) {
            const cacheKey = opt.key ? opt.key.call(this, objId, method, args) : `cache#{ojb_${objId}}#${method}#${JSON.stringify(args)}`
            if (await usedCacheStore.has(cacheKey)) {
                return usedCacheStore.get(cacheKey)
            }
            let value = await orginMethod.apply(this, args)
            await usedCacheStore.set(cacheKey, opt.ttl, value)
            return value
        }
    };
}