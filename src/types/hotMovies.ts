export type HotKind = 'movie' | 'tv';
export type HotSource = 'douban' | 'tmdb';
export type TrendingWindow = 'day' | 'week';

/** 榜单只保留作品资料，不转发豆瓣返回的用户、评论及追踪信息。 */
export interface HotItem {
    id: string;
    rank: number;
    title: string;
    originalTitle?: string;
    year?: string;
    info?: string;
    rating?: number;
}

export interface HotFeed {
    items: HotItem[];
    fetchedAt: string;
}

/** 将电影和电视剧搜索结果映射为相同字段，避免误用混合搜索的人物结果。 */
export interface HotSearchItem {
    id: number;
    title: string;
    original_title?: string;
    release_date?: string;
    poster_path?: string | null;
    overview?: string;
    vote_average?: number;
}

/** 榜单共用的 TMDB 资料；电视剧字段映射为电影同名字段后展示。 */
export interface TrendingMovie extends HotSearchItem {
    genre_ids?: number[];
    origin_country?: string[];
}

/** TMDB 电视剧趋势接口的原始字段，保留地区代码和电视剧专属类型。 */
export interface TrendingTVShow extends Omit<TrendingMovie, 'title' | 'original_title' | 'release_date'> {
    name: string;
    original_name?: string;
    first_air_date?: string;
}

export interface HotRow {
    item: HotItem;
    movie?: TrendingMovie;
    status: 'loading' | 'matched' | 'unmatched' | 'error';
    error?: string;
}
