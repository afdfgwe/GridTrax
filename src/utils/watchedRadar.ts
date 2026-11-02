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

/** 展示全部已观看类型，沿用条形图计数规则；不足六轴时仅补充空轴。 */
export function buildWatchedRadarStats(
    records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedRadarKind,
) {
    const stats = buildWatchedGenreStats(records, metadata, kind);
    const rows = stats.rows.filter(row => row.key !== UNKNOWN_GENRE);
    const axes = Array.from({length: Math.max(MIN_RADAR_AXIS_COUNT, rows.length)}, (_, index): WatchedRadarAxis | null => {
        const row = rows[index];
        return row ? {key: row.key, name: row.name, count: row.records.length, share: row.share} : null;
    });
    const step = Math.max(1, Math.ceil((rows[0]?.records.length ?? 0) / 4));
    return {axes, step, maximum: step * 4, total: stats.total, resolved: stats.resolved, genreCount: stats.genreCount};
}
