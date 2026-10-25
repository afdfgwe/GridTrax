import type {TVListKind, TVListResponse, TVListSelection} from '../types/hotMovies.ts';

export const TV_LIST_LABELS: Record<TVListSelection, string> = {
    trending: '趋势榜', airing_today: '今日播出', on_the_air: '正在播出', popular: '热门', top_rated: '高分',
};

/** 网址参数只接受已提供的列表，其他值回退到现有趋势榜。 */
export function resolveTVList(value: string | null): TVListSelection {
    return value === 'airing_today' || value === 'on_the_air' || value === 'popular' || value === 'top_rated'
        ? value : 'trending';
}

/** 独立列表页默认展示今日播出，不允许旧参数将其切回趋势榜。 */
export function resolveTVListKind(value: string | null): TVListKind {
    const list = resolveTVList(value);
    return list === 'trending' ? 'airing_today' : list;
}

/** TMDB 最多支持访问前 500 页；非法页码回到第一页。 */
export function resolveTVListPage(value: string | number | null): number {
    const page = Number(value);
    return Number.isSafeInteger(page) ? Math.min(500, Math.max(1, page)) : 1;
}

/** 播出列表统一使用北京时间；CN 是国家代码，timezone 使用对应的时区名称。 */
export function getTVListRequest(list: TVListKind, page: number) {
    return {
        path: `/tv/${list}`,
        params: {
            language: 'zh-CN', page: resolveTVListPage(page),
            ...((list === 'airing_today' || list === 'on_the_air') && {timezone: 'Asia/Shanghai'}),
        },
    };
}

/** 保留服务端页码和顺序，限制可访问总页数，不用当前页条数推算总页数。 */
export function normalizeTVListResponse(data: TVListResponse): TVListResponse {
    if (!data || !Array.isArray(data.results) || !Number.isSafeInteger(data.page) || data.page < 1
        || data.page > 500 || !Number.isSafeInteger(data.total_pages) || data.total_pages < 0
        || !Number.isSafeInteger(data.total_results) || data.total_results < 0) {
        throw new Error('电视剧列表格式错误');
    }
    return {...data, total_pages: Math.min(500, data.total_pages)};
}
