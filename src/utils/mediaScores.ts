import type {ProgressRecord, TMDBMovie, TMDBTVShow} from '../types';

const validScore = (score?: number): number =>
    typeof score === 'number' && Number.isFinite(score) && score > 0 ? score : 0;

/** 一次作品详情即可取得整部和各季评分；零值表示暂无有效评分。 */
export function getMediaScores(detail: TMDBMovie | TMDBTVShow): Record<string, number> {
    if ('seasons' in detail) {
        return {
            [`tv_season-${detail.id}`]: validScore(detail.vote_average),
            ...Object.fromEntries(detail.seasons.map(season => [
                `tv_season-${detail.id}-${season.season_number}`, validScore(season.vote_average),
            ])),
        };
    }
    return {[`movie-${detail.id}`]: validScore(detail.vote_average)};
}

/** 电视剧优先使用本季评分，缺失时回退到整部剧；不读取历史个人评分。 */
export function getMediaScore(record: ProgressRecord, scores: Record<string, number>): number {
    const key = `${record.type}-${record.tmdb_id}`;
    if (record.type === 'tv_season') {
        const seasonScore = validScore(scores[`${key}-${record.season_number}`]);
        if (seasonScore > 0) return seasonScore;
    }
    return validScore(scores[key]);
}
