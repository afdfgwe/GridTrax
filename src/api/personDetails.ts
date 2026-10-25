import type {TMDBPerson} from '../types/index.ts';

/** 中文资料优先；只有简介缺失时补取英文，避免覆盖中文姓名等其他信息。 */
export async function loadPersonDetails(
    fetchPerson: (language: 'zh-CN' | 'en-US') => Promise<TMDBPerson>,
): Promise<TMDBPerson> {
    const person = await fetchPerson('zh-CN');
    if (person.biography?.trim()) return person;

    try {
        const english = await fetchPerson('en-US');
        const biography = english.biography?.trim();
        return biography ? {...person, biography} : person;
    } catch {
        // 补充请求失败不阻断中文资料；结果按现有缓存有效期保留，到期后可重新尝试。
        return person;
    }
}
