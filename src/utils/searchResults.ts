import type {TMDBCollectionSearchResult, TMDBSearchPage, TMDBSearchResult} from '../types/index.ts';

export const SEARCH_CATEGORIES = [
    {value: 'all', label: '全部'},
    {value: 'movie', label: '电影'},
    {value: 'tv', label: '电视剧'},
    {value: 'collection', label: '合集'},
    {value: 'person', label: '人物'},
] as const;

export type SearchCategory = typeof SEARCH_CATEGORIES[number]['value'];
export type MediaSearchCategory = TMDBSearchResult['media_type'];

/** 旧搜索链接和手动输入的未知分类统一回退为全部。 */
export function getSearchCategory(value: string | null): SearchCategory {
    return SEARCH_CATEGORIES.find(category => category.value === value)?.value ?? 'all';
}

/** 单类搜索没有 media_type 字段，在请求边界补齐以复用原有卡片和详情跳转。 */
export function normalizeCategorySearchPage(
    data: TMDBSearchPage<Omit<TMDBSearchResult, 'media_type'>>,
    category: MediaSearchCategory,
): TMDBSearchPage<TMDBSearchResult> {
    if (!Array.isArray(data.results)) throw new Error('分类搜索结果格式错误');
    return {
        ...data,
        total_pages: Math.min(data.total_pages, 500),
        results: data.results.map(item => ({...item, media_type: category})),
    };
}

export interface CombinedSearchPage {
    page: number;
    total_pages: number;
    results: TMDBSearchResult[];
    collections: TMDBCollectionSearchResult[];
    warning?: string;
}

/** 两类搜索并行执行，单个接口失败时仍保留另一个接口的结果和分页。 */
export async function loadSearchResults(
    page: number,
    loadMulti: () => Promise<TMDBSearchPage<TMDBSearchResult>>,
    loadCollections: () => Promise<TMDBSearchPage<TMDBCollectionSearchResult>>,
): Promise<CombinedSearchPage> {
    const [multi, collections] = await Promise.allSettled([
        Promise.resolve().then(loadMulti), Promise.resolve().then(loadCollections),
    ]);
    if (multi.status === 'rejected' && collections.status === 'rejected') throw multi.reason;

    const multiData = multi.status === 'fulfilled' ? multi.value : undefined;
    const collectionData = collections.status === 'fulfilled' ? collections.value : undefined;
    return {
        page,
        // 任意一类仍有下一页时均可继续，较短的列表自然返回空数组。
        total_pages: Math.min(500, Math.max(multiData?.total_pages ?? 0, collectionData?.total_pages ?? 0)),
        results: multiData?.results ?? [],
        collections: collectionData?.results ?? [],
        warning: multi.status === 'rejected' ? '影视与人物搜索暂时失败，当前仅显示合集。'
            : collections.status === 'rejected' ? '合集搜索暂时失败，其他搜索结果不受影响。' : undefined,
    };
}
