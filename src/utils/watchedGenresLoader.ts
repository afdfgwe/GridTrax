import type {ProgressRecord, TMDBMovie, TMDBTVShow} from '../types/index.ts';
import {
    getMediaMetadataKey,
    toMediaMetadata,
    type MediaMetadata,
    type createMediaMetadataCache
} from './mediaMetadataCache.ts';
import {getWatchedRecords} from './watchedGenres.ts';

interface Snapshot {
    metadata: Record<string, MediaMetadata>;
    pendingCount: number;
    failedCount: number;
}

interface Options {
    cache: ReturnType<typeof createMediaMetadataCache>;
    load: (record: ProgressRecord) => Promise<TMDBMovie | TMDBTVShow>;
}

/** 五路补位队列，同剧多季只取一次整剧详情；不写观看记录，也不取消其他页面共享的请求。 */
export function createWatchedGenresLoader(initialRecords: ProgressRecord[], options: Options) {
    let records = new Map<string, ProgressRecord>();
    const values = new Map<string, MediaMetadata>();
    const pending = new Map<string, ProgressRecord>();
    const inFlight = new Set<string>();
    const attempted = new Set<string>();
    const failures = new Set<string>();
    const listeners = new Set<() => void>();
    let running = false;
    let snapshot: Snapshot = {metadata: {}, pendingCount: 0, failedCount: 0};

    function publish() {
        snapshot = {
            metadata: Object.fromEntries([...values].filter(([key]) => records.has(key))),
            pendingCount: [...records.keys()].filter(key => pending.has(key) || inFlight.has(key)).length,
            failedCount: [...failures].filter(key => records.has(key)).length,
        };
        listeners.forEach(listener => listener());
    }

    function pump() {
        if (!running) return;
        while (pending.size && inFlight.size < 5) {
            const [key, record] = pending.entries().next().value!;
            pending.delete(key);
            inFlight.add(key);
            attempted.add(key);
            void Promise.resolve().then(() => options.load(record)).then(detail => {
                const metadata = toMediaMetadata(detail);
                // 类型缺失与未请求区分开：成功返回但未标注时计入“未标注类型”。
                metadata.genres ??= [];
                values.set(key, metadata);
                options.cache.set(key, metadata);
                failures.delete(key);
            }).catch(() => failures.add(key)).finally(() => {
                inFlight.delete(key);
                if (running) {
                    pump();
                    publish();
                }
                if (!inFlight.size) options.cache.flush();
            });
        }
    }

    function update(nextRecords: ProgressRecord[]) {
        records = new Map(getWatchedRecords(nextRecords).map(record => [getMediaMetadataKey(record), record]));
        pending.clear();
        for (const [key, record] of records) {
            const cached = options.cache.get(key);
            const current = values.get(key);
            if (cached && (!current || cached.fetchedAt > current.fetchedAt)) values.set(key, cached);
            const metadata = values.get(key);
            if (!attempted.has(key) && !inFlight.has(key) &&
                (!metadata || metadata.genres === undefined || !options.cache.isFresh(metadata))) pending.set(key, record);
        }
        // 移除已删除记录的页面数据，进行中的结果仍可进入有容量限制的公共缓存。
        for (const key of values.keys()) if (!records.has(key)) values.delete(key);
        pump();
        publish();
    }

    update(initialRecords);
    return {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        update,
        start() {
            running = true;
            pump();
            publish();
        },
        stop() {
            running = false;
            options.cache.flush();
        },
        retry() {
            for (const key of failures) {
                const record = records.get(key);
                if (record && !inFlight.has(key)) pending.set(key, record);
            }
            failures.clear();
            pump();
            publish();
        },
    };
}
