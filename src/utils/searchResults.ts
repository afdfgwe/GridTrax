import type {TMDBCollectionSearchResult, TMDBSearchPage, TMDBSearchResult} from '../types/index.ts';

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
