import type {ProgressRecord} from '../types/index.ts';
import {getMediaMetadataKey, type MediaMetadata} from './mediaMetadataCache.ts';

export type WatchedKind = 'all' | ProgressRecord['type'];
export const UNKNOWN_GENRE = 'unknown';

export function getWatchedRecordKey(record: ProgressRecord) {
    return `${getMediaMetadataKey(record)}${record.type === 'tv_season' ? `-${record.season_number}` : ''}`;
}

/** 与“看过”面板保持一致：电影按部、电视剧按季去重，不统计其他观看状态。 */
export function getWatchedRecords(records: readonly ProgressRecord[]) {
    return [...new Map(records.filter(record => record.global_status === 'Collect')
        .map(record => [getWatchedRecordKey(record), record])).values()]
        .sort((a, b) => (b.last_interacted ?? 0) - (a.last_interacted ?? 0));
}

export interface WatchedGenreRow {
    key: string;
    name: string;
    records: ProgressRecord[];
    movies: number;
    seasons: number;
    share: number;
}

const translatedNames: Record<string, string> = {
    'Sci-Fi & Fantasy': '科幻与奇幻',
    'War & Politics': '战争与政治',
};

/** 多类型独立计数，占比以当前筛选下的全部看过记录为分母，未加载不冒充“未知类型”。 */
export function buildWatchedGenreStats(records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedKind = 'all') {
    const watched = getWatchedRecords(records).filter(record => kind === 'all' || record.type === kind);
    const groups = new Map<string, WatchedGenreRow>();
    let resolved = 0;
    for (const record of watched) {
        const genres = metadata[getMediaMetadataKey(record)]?.genres;
        if (!genres) continue;
        resolved++;
        const unique = new Map(genres.map(genre => [String(genre.id), translatedNames[genre.name] ?? genre.name]));
        if (!unique.size) unique.set(UNKNOWN_GENRE, '未标注类型');
        for (const [key, name] of unique) {
            let row = groups.get(key);
            if (!row) {
                row = {key, name, records: [], movies: 0, seasons: 0, share: 0};
                groups.set(key, row);
            }
            row.records.push(record);
            if (record.type === 'movie') row.movies++;
            else row.seasons++;
        }
    }
    const rows = [...groups.values()].map(row => ({
        ...row,
        share: watched.length ? row.records.length / watched.length : 0
    }))
        .sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name, 'zh-CN'));
    const movies = watched.filter(record => record.type === 'movie').length;
    return {
        records: watched, rows, resolved, total: watched.length, movies,
        seasons: watched.length - movies,
        shows: new Set(watched.filter(record => record.type === 'tv_season').map(record => record.tmdb_id)).size,
        genreCount: rows.filter(row => row.key !== UNKNOWN_GENRE).length,
    };
}
