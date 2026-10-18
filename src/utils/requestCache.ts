/** 有容量和有效期限制的内存缓存；共用进行中的请求，但不缓存失败结果。 */
export function createRequestCache<T>(maxEntries = 160, ttl = 5 * 60_000, now = Date.now) {
    const entries = new Map<string, { promise: Promise<T>; expires: number }>();
    return {
        load(key: string, loader: () => Promise<T>): Promise<T> {
            const cached = entries.get(key);
            if (cached && cached.expires > now()) {
                entries.delete(key);
                entries.set(key, cached);
                return cached.promise;
            }
            const entry = {promise: Promise.resolve().then(loader), expires: Infinity};
            entries.set(key, entry);
            entry.promise = entry.promise.then((value) => {
                entry.expires = now() + ttl;
                return value;
            }, (error: unknown) => {
                // 被容量淘汰的旧请求不能删除同名的新请求。
                if (entries.get(key) === entry) entries.delete(key);
                throw error;
            });
            while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
            return entry.promise;
        },
    };
}
