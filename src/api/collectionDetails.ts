import type {TMDBCollection} from '../types/index.ts';

/** 中文合集资料优先，缺少简介时仅补充英文简介，不替换中文片名或成员电影。 */
export async function loadCollectionDetails(
    fetchCollection: (language: 'zh-CN' | 'en-US') => Promise<TMDBCollection>,
): Promise<TMDBCollection> {
    const collection = await fetchCollection('zh-CN');
    if (!Array.isArray(collection.parts)) throw new Error('合集列表格式错误');
    if (collection.overview?.trim()) return collection;

    try {
        const english = await fetchCollection('en-US');
        const overview = english.overview?.trim();
        return overview ? {...collection, overview} : collection;
    } catch {
        // 英文补充失败不阻断合集展示；现有缓存到期后可重新尝试。
        return collection;
    }
}
