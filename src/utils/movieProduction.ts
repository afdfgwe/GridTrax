import type {TMDBCountry, TMDBProductionCountry} from '../types/index.ts';

/** 优先使用中文地区字典；字典未加载或失败时保留接口名称，且不改写详情数据。 */
export function getProductionCountriesText(
    countries?: readonly TMDBProductionCountry[] | null,
    dictionary: readonly TMDBCountry[] = [],
): string {
    const names = new Map(dictionary.map(country => [
        country.iso_3166_1.trim().toUpperCase(),
        country.native_name?.trim() || country.english_name?.trim(),
    ]));
    const labels = countries?.map(country => {
        const code = country.iso_3166_1.trim().toUpperCase();
        return names.get(code) || country.name.trim() || code;
    }).filter(Boolean) ?? [];
    return [...new Set(labels)].join('、');
}
