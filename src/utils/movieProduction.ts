import type {TMDBCountry, TMDBProductionCountry, TMDBSpokenLanguage} from '../types/index.ts';

/** 语言保留接口顺序并去重；本地名称为空时回退英文名称或语言代码。 */
export function getSpokenLanguagesText(languages?: readonly TMDBSpokenLanguage[] | null): string {
    const labels = languages?.map(language =>
        language.name?.trim() || language.english_name?.trim() || language.iso_639_1?.trim(),
    ).filter(Boolean) ?? [];
    return [...new Set(labels)].join('、');
}

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
