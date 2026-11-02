import type {ProgressRecord} from '../types/index.ts';
import type {MediaMetadata} from './mediaMetadataCache.ts';
import {buildWatchedGenreStats, UNKNOWN_GENRE} from './watchedGenres.ts';

export const MIN_RADAR_AXIS_COUNT = 6;
export type WatchedRadarKind = ProgressRecord['type'];

export interface WatchedRadarAxis {
    key: string;
    name: string;
    count: number;
    share: number;
}

/** 平方根刻度压缩数量差距，保留零值，并将异常输入限制在有效半径内。 */
export function getWatchedRadarRatio(count: number, maximum: number) {
    if (!Number.isFinite(count) || !Number.isFinite(maximum) || count <= 0 || maximum <= 0) return 0;
    return Math.sqrt(Math.min(count / maximum, 1));
}

/** 沿用真实计数，按类型编号固定顺序，未标注类型置后；不足六轴时补充空轴。 */
export function buildWatchedRadarStats(
    records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedRadarKind,
) {
    const stats = buildWatchedGenreStats(records, metadata, kind);
    const rows = [...stats.rows].sort((a, b) => {
        if (a.key === b.key) return 0;
        if (a.key === UNKNOWN_GENRE) return 1;
        if (b.key === UNKNOWN_GENRE) return -1;
        return Number(a.key) - Number(b.key);
    });
    const unknownCount = rows.find(row => row.key === UNKNOWN_GENRE)?.records.length ?? 0;
    const axes = Array.from({length: Math.max(MIN_RADAR_AXIS_COUNT, rows.length)}, (_, index): WatchedRadarAxis | null => {
        const row = rows[index];
        return row ? {key: row.key, name: row.name, count: row.records.length, share: row.share} : null;
    });
    const largestCount = rows.reduce((maximum, row) => Math.max(maximum, row.records.length), 0);
    const step = Math.max(1, Math.ceil(largestCount / 4));
    return {axes, step, maximum: step * 4, total: stats.total, resolved: stats.resolved, genreCount: stats.genreCount, unknownCount};
}
