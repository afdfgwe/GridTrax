import type {TMDBSearchResult} from './index.ts';

/** 豆瓣与类型字典只使用影视类别；人物榜仅在 TMDB 来源下提供。 */
export type HotKind = 'movie' | 'tv';
export type HotCategory = HotKind | 'person';
export type HotSource = 'douban' | 'tmdb';
export type TrendingWindow = 'day' | 'week';
export type TVListKind = 'airing_today' | 'on_the_air' | 'popular' | 'top_rated';
export type TVListSelection = 'trending' | TVListKind;
export type MovieListKind = 'now_playing' | 'popular' | 'top_rated' | 'upcoming';

/** 电影与电视剧列表共用分页元数据，但保留各自的标题和日期字段。 */
export interface MediaListResponse<T> {
    page: number;
    results: T[];
    total_pages: number;
    total_results: number;
}

export type TVListResponse = MediaListResponse<TrendingTVShow>;
export type MovieListResponse = MediaListResponse<TrendingMovie>;

/** 榜单只保留作品资料，不转发豆瓣返回的用户、评论及追踪信息。 */
export interface HotItem {
    id: string;
    rank: number;
    title: string;
    originalTitle?: string;
    year?: string;
    info?: string; // 豆瓣 info 原文，依次为地区/类型/导演/演员，由 parseHotMovieInfo 拆分。
    rating?: number; // 豆瓣评分（0 到 10），不是 TMDB 评分；0 值不展示。
}

/** fetchedAt 是本次抓取时间，不是豆瓣发布或更新榜单的时间。 */
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

/** 人物趋势条目不含影片评分，代表作品仅用于展示和跳转，不逐项请求详情。 */
export interface TrendingPerson {
    id: number;
    name: string;
    original_name?: string;
    profile_path?: string | null;
    known_for_department?: string;
    known_for?: TMDBSearchResult['known_for'];
}

/** 一行同时保存榜单原始资料与 TMDB 补全资料；未匹配和请求失败是两种不同状态。 */
export interface HotRow {
    item: HotItem;
    movie?: TrendingMovie;
    person?: TrendingPerson;
    status: 'loading' | 'matched' | 'unmatched' | 'error';
    error?: string;
}
