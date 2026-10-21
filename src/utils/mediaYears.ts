import type {ProgressRecord, TMDBMovie, TMDBTVShow} from '../types';

/** 电视剧年份按季区分，电影年份按作品区分。 */
export function getMediaYearKey(record: ProgressRecord): string {
    return record.type === 'tv_season'
        ? `tv_season-${record.tmdb_id}-${record.season_number}`
        : `movie-${record.tmdb_id}`;
}

/** 利用已有详情中的季摘要获取年份，不额外请求各季，也不回退到整部剧的首播年。 */
export function getMediaYears(detail: TMDBMovie | TMDBTVShow): Record<string, string> {
    // 上映日期是日历文本，直接截取年份，避免转为 Date 后受时区影响。
    const getYear = (date?: string) => date && /^\d{4}/.test(date) ? date.slice(0, 4) : '';
    if ('seasons' in detail) {
        return Object.fromEntries(detail.seasons.map(season => [
            `tv_season-${detail.id}-${season.season_number}`, getYear(season.air_date),
        ]));
    }
    return {[`movie-${detail.id}`]: getYear(detail.release_date)};
}
