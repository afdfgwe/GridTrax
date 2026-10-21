import type {ProgressRecord, TMDBMovie, TMDBTVShow} from '../types/index.ts';
import {getMediaScores} from './mediaScores.ts';
import {getMediaYears} from './mediaYears.ts';

// 接口资料与观影记录分开存储；只缓存小字段，不保存简介、集数或用户操作时间。
export const MEDIA_METADATA_STORAGE_KEY = 'gridtrax-media-metadata-v1';
export const MEDIA_METADATA_TTL = 6 * 60 * 60_000;
const MAX_ENTRIES = 1000;
const MAX_STORAGE_CHARS = 250_000;
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface MediaMetadata {
    scores: Record<string, number>;
    years: Record<string, string>;
    posterPath?: string;
    fetchedAt: number;
}

export const getMediaMetadataKey = (record: ProgressRecord) => `${record.type}-${record.tmdb_id}`;

export function toMediaMetadata(detail: TMDBMovie | TMDBTVShow, now = Date.now()): MediaMetadata {
    return {
        scores: getMediaScores(detail), years: getMediaYears(detail),
        posterPath: detail.poster_path || undefined, fetchedAt: now,
    };
}

function validMetadata(key: string, value: unknown): value is MediaMetadata {
    if (!/^(movie|tv_season)-\d+$/.test(key) || !value || typeof value !== 'object') return false;
    const item = value as MediaMetadata;
    const validKey = (field: string) => field === key ||
        (key.startsWith('tv_season-') && field.startsWith(`${key}-`) && /^\d+$/.test(field.slice(key.length + 1)));
    return Number.isFinite(item.fetchedAt) && item.fetchedAt > 0 &&
        (item.posterPath === undefined || typeof item.posterPath === 'string') &&
        !!item.scores && typeof item.scores === 'object' && !Array.isArray(item.scores) &&
        Object.entries(item.scores).every(([field, score]) => validKey(field) && Number.isFinite(score) && score >= 0 && score <= 10) &&
        !!item.years && typeof item.years === 'object' && !Array.isArray(item.years) &&
        Object.entries(item.years).every(([field, year]) => validKey(field) && typeof year === 'string' && /^(\d{4})?$/.test(year));
}

/** 缓存过期后仍可先展示旧值，再由加载器后台更新；存储故障只影响缓存。 */
export function createMediaMetadataCache(access: () => StorageAccess, now = Date.now) {
    const entries = new Map<string, MediaMetadata>();
    let loaded = false;
    let dirty = false;
    let writeDisabled = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    function read() {
        if (loaded) return;
        loaded = true;
        try {
            const raw = access().getItem(MEDIA_METADATA_STORAGE_KEY);
            if (!raw || raw.length > MAX_STORAGE_CHARS) return;
            const data = JSON.parse(raw);
            if (data.version !== 1 || !Array.isArray(data.entries)) return;
            for (const pair of data.entries.slice(-MAX_ENTRIES)) {
                if (!Array.isArray(pair) || pair.length !== 2) continue;
                const [key, item] = pair;
                if (typeof key === 'string' && validMetadata(key, item)) entries.set(key, item);
            }
        } catch { /* 损坏或禁用的缓存不影响观影记录，也不阻止重新请求接口。 */ }
    }

    function flush() {
        if (saveTimer !== undefined) clearTimeout(saveTimer);
        saveTimer = undefined;
        if (!dirty || writeDisabled) return;
        dirty = false;
        try {
            // 限制缓存体积，避免挤占观影记录存储；优先淘汰最久未访问的资料。
            const kept: [string, MediaMetadata][] = [];
            let size = 32;
            for (const pair of [...entries].reverse()) {
                const length = JSON.stringify(pair).length + 1;
                if (size + length > MAX_STORAGE_CHARS) entries.delete(pair[0]);
                else {
                    kept.push(pair);
                    size += length;
                }
            }
            access().setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({version: 1, entries: kept.reverse()}));
        } catch {
            writeDisabled = true;
            try { access().removeItem(MEDIA_METADATA_STORAGE_KEY); } catch { /* 仅尝试释放本缓存占用的空间。 */ }
        }
    }

    return {
        get(key: string) {
            read();
            const item = entries.get(key);
            if (item) {
                entries.delete(key);
                entries.set(key, item);
            }
            return item;
        },
        isFresh(item: MediaMetadata) {
            const age = now() - item.fetchedAt;
            return age >= 0 && age < MEDIA_METADATA_TTL;
        },
        set(key: string, item: MediaMetadata) {
            read();
            entries.delete(key);
            entries.set(key, item);
            while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
            dirty = true;
            // 合并连续响应的写入，不对每部影片同步序列化全部缓存。
            if (!writeDisabled && saveTimer === undefined) saveTimer = setTimeout(flush, 300);
        },
        flush,
    };
}

export const mediaMetadataCache = createMediaMetadataCache(() => window.localStorage);
