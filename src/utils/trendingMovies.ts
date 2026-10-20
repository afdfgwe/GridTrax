import type {HotRow, TrendingMovie} from '../types/hotMovies.ts';
import type {TMDBGenre} from '../types/index.ts';

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

/** 原名单独展示；类型按接口编号顺序转为中文，未知编号和缺失资料不占行。 */
export function getTrendingInfo(movie?: TrendingMovie, genres: readonly TMDBGenre[] = []) {
    const names = new Map(genres.map(genre => [genre.id, genre.name.trim()]));
    return [
        {label: '上映', value: movie?.release_date?.trim()},
        {label: '类型', value: movie?.genre_ids?.map(id => names.get(id)).filter(Boolean).join(' ')},
    ].filter(part => part.value);
}
