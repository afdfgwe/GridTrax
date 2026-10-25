import type {MovieListKind, MovieListResponse} from '../types/hotMovies.ts';
import {resolveTVListPage} from './tvLists.ts';

export const MOVIE_LIST_LABELS: Record<MovieListKind, string> = {
    now_playing: '正在热映', popular: '热门', top_rated: '高分', upcoming: '即将上映',
};

/** 只接受四种电影列表；电视剧参数和无效参数回退到正在热映。 */
export function resolveMovieListKind(value: string | null): MovieListKind {
    return value === 'popular' || value === 'top_rated' || value === 'upcoming' ? value : 'now_playing';
}

/** 地区使用国家代码 CN，与电视剧播出接口的 timezone 参数区分。 */
export function getMovieListRequest(list: MovieListKind, page: number) {
    return {
        path: `/movie/${list}`,
        params: {language: 'zh-CN', region: 'CN', page: resolveTVListPage(page)},
    };
}

/** 保留接口排序、上映日期及分页数据；空列表有效，非法分页不进入页面。 */
export function normalizeMovieListResponse(data: MovieListResponse): MovieListResponse {
    if (!data || !Array.isArray(data.results) || !Number.isSafeInteger(data.page) || data.page < 1
        || data.page > 500 || !Number.isSafeInteger(data.total_pages) || data.total_pages < 0
        || !Number.isSafeInteger(data.total_results) || data.total_results < 0) {
        throw new Error('电影列表格式错误');
    }
    return {...data, total_pages: Math.min(500, data.total_pages)};
}
