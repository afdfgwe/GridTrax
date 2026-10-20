export type HotKind = 'movie' | 'tv';

/** 榜单只保留作品资料，不转发豆瓣返回的用户、评论及追踪信息。 */
export interface HotItem {
    id: string;
    rank: number;
    title: string;
    originalTitle?: string;
    year?: string;
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

export interface HotRow {
    item: HotItem;
    movie?: HotSearchItem;
    status: 'loading' | 'matched' | 'unmatched' | 'error';
    error?: string;
}
