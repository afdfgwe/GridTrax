import type {ProgressRecord, TMDBMovie, TMDBTVShow} from '../types';

// 统一用 0 表示不可展示的评分，卡片隐藏与评分排序由同一规则决定。
const validScore = (score?: number): number =>
    typeof score === 'number' && Number.isFinite(score) && score > 0 ? score : 0;

/** 一次作品详情即可取得整部和各季评分；零值表示暂无有效评分。 */
export function getMediaScores(detail: TMDBMovie | TMDBTVShow): Record<string, number> {
    if ('seasons' in detail) {
        const showScores = {[`tv_season-${detail.id}`]: validScore(detail.vote_average)};
        // 优先采用接口总季数；缺失时统计正片季，特别篇不算额外一季。
        const seasonCount = detail.number_of_seasons
            ?? detail.seasons.filter(season => season.season_number > 0).length;
        if (seasonCount === 1) return showScores;
        return {
            ...showScores,
            ...Object.fromEntries(detail.seasons.map(season => [
                `tv_season-${detail.id}-${season.season_number}`, validScore(season.vote_average),
            ])),
        };
    }
    return {[`movie-${detail.id}`]: validScore(detail.vote_average)};
}

/** 单季剧仅保存整剧评分；多季剧优先本季评分，缺失时回退整剧，不读取历史个人评分。 */
export function getMediaScore(record: ProgressRecord, scores: Record<string, number>): number {
    const key = `${record.type}-${record.tmdb_id}`;
    if (record.type === 'tv_season') {
        const seasonScore = validScore(scores[`${key}-${record.season_number}`]);
        if (seasonScore > 0) return seasonScore;
    }
    return validScore(scores[key]);
}
