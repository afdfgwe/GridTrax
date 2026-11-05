import type {ProgressRecord} from '../../types/index.ts';
import {getMediaMetadataKey, type MediaMetadata} from '../media/mediaMetadataCache.ts';
import {getMediaScore} from '../media/mediaScores.ts';
import {getWatchedRecords, type WatchedGenreRow, type WatchedKind} from './watchedGenres.ts';

/** 按卡片实际评分分档；保留空档供折线归零，0 表示未评分，不进入任何统计分母。 */
export function buildWatchedScoreStats(
    records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedKind = 'all', minVotes = 0,
) {
    const watched = getWatchedRecords(records).filter(record => kind === 'all' || record.type === kind);
    const rows: WatchedGenreRow[] = Array.from({length: 10}, (_, index) => ({
        key: String(index), name: `${index}-${index + 1} 分`, records: [], movies: 0, seasons: 0, share: 0,
    }));
    const included: ProgressRecord[] = [];
    let resolved = 0;
    let scoreSum = 0;
    let highScoreCount = 0;
    for (const record of watched) {
        const data = metadata[getMediaMetadataKey(record)];
        if (!data) continue;
        if (minVotes > 0 && data.voteCount === undefined) continue;
        resolved++;
        // 电视剧沿用整剧评分人数，季摘要没有 vote_count；缺失人数不能通过非零门槛。
        if (minVotes > 0 && (typeof data.voteCount !== 'number' || !Number.isSafeInteger(data.voteCount) || data.voteCount < minVotes)) continue;
        const score = getMediaScore(record, data.scores);
        if (!Number.isFinite(score) || score <= 0 || score > 10) continue;
        // 使用原始值分档，不让 7.96 四舍五入后进入 8 分档；10 分纳入最后一档。
        const row = rows[Math.min(9, Math.floor(score))];
        row.records.push(record);
        if (record.type === 'movie') row.movies++;
        else row.seasons++;
        included.push(record);
        scoreSum += score;
        if (score >= 8) highScoreCount++;
    }
    for (const row of rows) row.share = included.length ? row.records.length / included.length : 0;
    const movies = included.filter(record => record.type === 'movie').length;
    return {
        records: included, rows, resolved, assignments: included.length,
        coverageCount: rows.filter(row => row.records.length > 0).length,
        sourceTotal: watched.length, total: included.length, movies, seasons: included.length - movies,
        shows: new Set(included.filter(record => record.type === 'tv_season').map(record => record.tmdb_id)).size,
        averageScore: included.length ? scoreSum / included.length : 0,
        highScoreCount, highScoreShare: included.length ? highScoreCount / included.length : 0,
    };
}
