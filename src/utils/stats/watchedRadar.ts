import type {ProgressRecord} from '../../types/index.ts';
import type {MediaMetadata} from '../media/mediaMetadataCache.ts';
import {buildWatchedGenreStats, UNKNOWN_GENRE} from './watchedGenres.ts';

export const MIN_RADAR_AXIS_COUNT = 6;
export type WatchedRadarKind = ProgressRecord['type'];

export interface WatchedRadarAxis {
    key: string;
    name: string;
    count: number;
    share: number;
}

/** 仅对有观看记录的已知类型取前三名，同量按类型编号排序，不改变雷达轴顺序。 */
export function getWatchedRadarHighlights(axes: readonly (WatchedRadarAxis | null)[]) {
    return new Map(axes.filter((axis): axis is WatchedRadarAxis =>
        axis !== null && axis.key !== UNKNOWN_GENRE && axis.count > 0)
        .sort((a, b) => b.count - a.count || Number(a.key) - Number(b.key))
        .slice(0, 3).map((axis, index) => [axis.key, index + 1]));
}

/** 平方根刻度压缩数量差距，保留零值，并将异常输入限制在有效半径内。 */
export function getWatchedRadarRatio(count: number, maximum: number) {
    if (!Number.isFinite(count) || !Number.isFinite(maximum) || count <= 0 || maximum <= 0) return 0;
    return Math.sqrt(Math.min(count / maximum, 1));
}

/** 只展示已标注类型，按类型编号固定顺序；不足六轴时补充空轴。 */
export function buildWatchedRadarStats(
    records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedRadarKind,
) {
    const stats = buildWatchedGenreStats(records, metadata, kind);
    const rows = [...stats.rows].sort((a, b) => Number(a.key) - Number(b.key));
    const axes = Array.from({length: Math.max(MIN_RADAR_AXIS_COUNT, rows.length)}, (_, index): WatchedRadarAxis | null => {
        const row = rows[index];
        return row ? {key: row.key, name: row.name, count: row.records.length, share: row.share} : null;
    });
    const largestCount = rows.reduce((maximum, row) => Math.max(maximum, row.records.length), 0);
    const step = Math.max(1, Math.ceil(largestCount / 4));
    return {
        axes,
        step,
        maximum: step * 4,
        total: stats.total,
        resolved: stats.resolved,
        sourceTotal: stats.sourceTotal,
        genreCount: stats.genreCount,
    };
}
