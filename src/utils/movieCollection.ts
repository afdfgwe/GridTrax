import type {TMDBMovieRecommendation} from '../types/index.ts';

/** 系列按上映日期排列，未知日期置后；去重时不修改接口或缓存中的原始数组。 */
export function getCollectionMovies(parts: readonly TMDBMovieRecommendation[]): TMDBMovieRecommendation[] {
    const seen = new Set<number>();
    const dateKey = (movie: TMDBMovieRecommendation) => {
        const date = movie.release_date?.trim() ?? '';
        return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) ? date : '9999-99-99';
    };
    return parts.filter((movie) => {
        if (!movie || !Number.isSafeInteger(movie.id) || movie.id <= 0 || seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
    }).sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
}
