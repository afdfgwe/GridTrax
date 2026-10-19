/** 榜单只保留作品资料，不转发豆瓣返回的用户、评论及追踪信息。 */
export interface HotMovie {
    id: string;
    rank: number;
    title: string;
    originalTitle?: string;
    year?: string;
    rating?: number;
}

export interface HotMoviesFeed {
    items: HotMovie[];
    fetchedAt: string;
}

/** 电影搜索没有 media_type 字段，不复用混合搜索的类型。 */
export interface MovieSearchItem {
    id: number;
    title: string;
    original_title?: string;
    release_date?: string;
    poster_path?: string | null;
    overview?: string;
}

export interface HotMovieRow {
    item: HotMovie;
    movie?: MovieSearchItem;
    status: 'loading' | 'matched' | 'unmatched' | 'error';
    error?: string;
}
