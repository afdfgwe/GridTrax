import type {TMDBEpisode} from '../types/index.ts';

/** 单集详情仅展示接口提供的有效值，不从整剧或整季信息中补齐。 */
export function getEpisodeDetails(episode: Pick<TMDBEpisode, 'air_date' | 'runtime' | 'overview'>) {
    const date = episode.air_date?.trim() ?? '';
    return {
        airDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
        runtime: typeof episode.runtime === 'number' && Number.isFinite(episode.runtime) && episode.runtime > 0
            ? episode.runtime : undefined,
        overview: episode.overview?.trim() ?? '',
    };
}
