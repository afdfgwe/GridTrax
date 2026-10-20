import type {HotRow, TrendingMovie} from '../types/hotMovies.ts';

/** 保持接口排名并复用榜单行结构，不把 TMDB 评分填入豆瓣评分字段。 */
export function toTrendingRows(movies: TrendingMovie[]): HotRow[] {
    return movies.map((movie, index) => ({
        item: {
            id: String(movie.id),
            rank: index + 1,
            title: movie.title,
            year: movie.release_date?.match(/^\d{4}(?=-)/)?.[0],
        },
        movie,
        status: 'matched',
    }));
}

/** 缺少的资料不占行，类型先使用接口提供的数字编号。 */
export function getTrendingInfo(movie?: TrendingMovie) {
    return [
        {label: '原名', value: movie?.original_title?.trim()},
        {label: '上映', value: movie?.release_date?.trim()},
        {label: '类型', value: movie?.genre_ids?.join(' / ')},
    ].filter(part => part.value);
}
