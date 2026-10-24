import type {ProgressRecord, TMDBMovie, TMDBTVShow} from '../types/index.ts';
import {getMediaMetadataKey, toMediaMetadata, type MediaMetadata, type createMediaMetadataCache} from './mediaMetadataCache.ts';

interface Snapshot {
    scores: Record<string, number>;
    years: Record<string, string>;
    failedCount: number;
}

interface LoaderOptions {
    cache: ReturnType<typeof createMediaMetadataCache>;
    load: (record: ProgressRecord) => Promise<TMDBMovie | TMDBTVShow>;
    fillPoster: (record: ProgressRecord, posterPath?: string) => void;
}

/** 持续补位的四路队列：可见卡片优先，其余记录仍会补齐以保证全量评分排序。 */
export function createHomeMediaDetailsLoader(initialRecords: ProgressRecord[], options: LoaderOptions) {
    let snapshot: Snapshot = {scores: {}, years: {}, failedCount: 0};
    let records = new Map<string, ProgressRecord>();
    let getPriorityKeys = (): string[] => [];
    const pending = new Map<string, ProgressRecord>(); // 待加载队列。
    const inFlight = new Set<string>(); // 正在进行中的请求。
    const attempted = new Set<string>(); // 本会话已尝试过的记录，避免重复补位。
    const failures = new Set<string>(); // 加载失败的记录，可手动重试。
    const hydrated = new Set<string>(); // 已把缓存值合入 snapshot 的记录，避免重复合并。
    const listeners = new Set<() => void>();
    let running = false;

    function publish() {
        snapshot = {...snapshot, failedCount: [...failures].filter(key => records.has(key)).length};
        listeners.forEach(listener => listener());
    }

    function apply(key: string, metadata: MediaMetadata) {
        // 整部资料完整替换，季评分或年份被上游移除时不能继续保留旧值。
        const scores = {...snapshot.scores};
        const years = {...snapshot.years};
        for (const values of [scores, years]) {
            for (const field of Object.keys(values)) {
                if (field === key || field.startsWith(`${key}-`)) delete values[field];
            }
        }
        Object.assign(scores, metadata.scores);
        Object.assign(years, metadata.years);
        snapshot = {scores, years, failedCount: snapshot.failedCount};
    }

    // 首次渲染同步恢复缓存，避免先出现空评分、空年份再补一帧。
    for (const record of initialRecords) {
        const key = getMediaMetadataKey(record);
        if (records.has(key)) continue;
        records.set(key, record);
        const metadata = options.cache.get(key);
        if (metadata) {
            Object.assign(snapshot.scores, metadata.scores);
            Object.assign(snapshot.years, metadata.years);
            hydrated.add(key);
        }
    }

    function pump() {
        if (!running) return;
        // 每次有空位时重新读取视口优先级，翻页和滚动不重启已在进行的请求。
        const priority = getPriorityKeys();
        while (inFlight.size < 4 && pending.size) {
            const key = priority.find(value => pending.has(value)) ?? pending.keys().next().value!;
            const record = pending.get(key)!;
            pending.delete(key);
            attempted.add(key);
            inFlight.add(key);
            void Promise.resolve().then(() => options.load(record)).then(detail => {
                const metadata = toMediaMetadata(detail);
                options.cache.set(key, metadata);
                failures.delete(key);
                if (!running || !records.has(key)) return;
                apply(key, metadata);
                hydrated.add(key);
                publish();
                options.fillPoster(records.get(key)!, metadata.posterPath);
            }).catch(() => {
                failures.add(key);
                if (running && records.has(key)) publish();
            }).finally(() => {
                inFlight.delete(key);
                pump();
                if (!pending.size && !inFlight.size) options.cache.flush();
            });
        }
    }

    return {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        update(nextRecords: ProgressRecord[], priority: () => string[]) {
            getPriorityKeys = priority;
            records = new Map(nextRecords.map(record => [getMediaMetadataKey(record), record]));
            const missingPosters = new Set(nextRecords.filter(record => !record.poster_path).map(getMediaMetadataKey));
            pending.clear();
            const scores = {...snapshot.scores};
            const years = {...snapshot.years};
            for (const [key, record] of records) {
                const metadata = options.cache.get(key);
                if (metadata) {
                    if (!hydrated.has(key)) {
                        Object.assign(scores, metadata.scores);
                        Object.assign(years, metadata.years);
                        hydrated.add(key);
                    }
                    if (missingPosters.has(key) && metadata.posterPath) options.fillPoster(record, metadata.posterPath);
                }
                if (!attempted.has(key) && !inFlight.has(key) && (!metadata || !options.cache.isFresh(metadata))) {
                    pending.set(key, record);
                }
            }
            snapshot = {...snapshot, scores, years};
            publish();
            pump();
        },
        start() {
            running = true;
            pump();
        },
        stop() {
            running = false;
            options.cache.flush();
        },
        retry() {
            for (const key of failures) {
                attempted.delete(key);
                const record = records.get(key);
                if (record && !inFlight.has(key)) pending.set(key, record);
            }
            failures.clear();
            publish();
            pump();
        },
    };
}
