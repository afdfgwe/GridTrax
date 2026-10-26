import {LANGUAGE_NAMES_ZH} from '../constants/languageNames.ts';

/** 发现电影只接收已开放的筛选项，统一处理表单、网址和接口参数。 */
export const DISCOVERY_SORTS = [
    {value: 'popularity.desc', label: '热度从高到低'},
    {value: 'vote_average.desc', label: '评分从高到低'},
    {value: 'primary_release_date.desc', label: '上映从新到旧'},
    {value: 'primary_release_date.asc', label: '上映从旧到新'},
    {value: 'vote_count.desc', label: '评分人数从多到少'},
    {value: 'revenue.desc', label: '票房从高到低'},
] as const;

export interface MovieDiscoveryFilters {
    genres: number[];
    country: string;
    language: string;
    yearFrom: string;
    yearTo: string;
    ratingFrom: string;
    ratingTo: string;
    minVotes: string;
    runtimeFrom: string;
    runtimeTo: string;
    sort: string;
}

export const DEFAULT_DISCOVERY_FILTERS: MovieDiscoveryFilters = {
    genres: [], country: '', language: '', yearFrom: '', yearTo: '', ratingFrom: '', ratingTo: '',
    minVotes: '', runtimeFrom: '', runtimeTo: '', sort: 'popularity.desc',
};

const numericFields = {
    yearFrom: [1870, 2100, true], yearTo: [1870, 2100, true],
    ratingFrom: [0, 10, false], ratingTo: [0, 10, false], minVotes: [0, 1_000_000_000, true],
    runtimeFrom: [0, 1000, true], runtimeTo: [0, 1000, true],
} as const;

function validNumber(value: string, min: number, max: number, integer: boolean) {
    return /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))
        && Number(value) >= min && Number(value) <= max && (!integer || Number.isInteger(Number(value)));
}

/** 非法地址参数回退默认值；不允许未知查询项透传到 TMDB。 */
export function parseMovieDiscovery(params: URLSearchParams): MovieDiscoveryFilters {
    const filters: MovieDiscoveryFilters = {...DEFAULT_DISCOVERY_FILTERS, genres: []};
    filters.genres = [...new Set((params.get('genres') ?? '').split(',')
        .filter(value => /^\d+$/.test(value)).map(Number)
        .filter(value => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b).slice(0, 30);
    const country = params.get('country') ?? '';
    const language = params.get('language') ?? '';
    if (/^[A-Za-z]{2}$/.test(country)) filters.country = country.toUpperCase();
    if (/^[a-z]{2}$/.test(language)) filters.language = language;
    const sort = params.get('sort');
    if (DISCOVERY_SORTS.some(option => option.value === sort)) filters.sort = sort!;
    for (const [key, [min, max, integer]] of Object.entries(numericFields)) {
        const value = params.get(key) ?? '';
        if (validNumber(value, min, max, integer)) filters[key as keyof typeof numericFields] = String(Number(value));
    }
    // 手动修改地址导致上下界倒置时，丢弃该范围，避免构造永远没有结果的查询。
    for (const [from, to] of rangePairs) {
        if (filters[from] && filters[to] && Number(filters[from]) > Number(filters[to])) {
            filters[from] = '';
            filters[to] = '';
        }
    }
    return filters;
}

const rangePairs = [
    ['yearFrom', 'yearTo'], ['ratingFrom', 'ratingTo'], ['runtimeFrom', 'runtimeTo'],
] as const;

/** 表单保留用户输入并逐项提示，不静默交换或截断数值。 */
export function validateMovieDiscovery(filters: MovieDiscoveryFilters): Partial<Record<keyof MovieDiscoveryFilters, string>> {
    const errors: Partial<Record<keyof MovieDiscoveryFilters, string>> = {};
    for (const [key, [min, max, integer]] of Object.entries(numericFields)) {
        const field = key as keyof typeof numericFields;
        if (filters[field] && !validNumber(filters[field], min, max, integer)) {
            errors[field] = `请输入 ${min}–${max} 的${integer ? '整数' : '数值'}`;
        }
    }
    for (const [from, to] of rangePairs) {
        if (!errors[from] && !errors[to] && filters[from] && filters[to] && Number(filters[from]) > Number(filters[to])) {
            errors[to] = '不能小于起始值';
        }
    }
    return errors;
}

export function resolveDiscoveryPage(value: string | null): number {
    const page = Number(value);
    return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 500) : 1;
}

/** 省略空条件及默认排序，筛选、翻页和详情返回共享同一份网址状态。 */
export function serializeMovieDiscovery(filters: MovieDiscoveryFilters, page = 1): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (key === 'genres') {
            if (filters.genres.length) params.set(key, [...new Set(filters.genres)].sort((a, b) => a - b).join(','));
        } else if (value && value !== DEFAULT_DISCOVERY_FILTERS[key as keyof MovieDiscoveryFilters]) {
            params.set(key, String(value));
        }
    }
    if (page > 1) params.set('page', String(resolveDiscoveryPage(String(page))));
    return params;
}

/** 多个类型按“任一类型”匹配；年份使用首映日期范围，不误用上映地区。 */
export function getMovieDiscoveryRequest(filters: MovieDiscoveryFilters, page = 1) {
    const params: Record<string, string | number | boolean> = {
        language: 'zh-CN', include_adult: false, include_video: false,
        sort_by: filters.sort, page: resolveDiscoveryPage(String(page)),
    };
    if (filters.genres.length) params.with_genres = filters.genres.join('|');
    if (filters.country) params.with_origin_country = filters.country;
    if (filters.language) params.with_original_language = filters.language;
    if (filters.yearFrom) params['primary_release_date.gte'] = `${filters.yearFrom}-01-01`;
    if (filters.yearTo) params['primary_release_date.lte'] = `${filters.yearTo}-12-31`;
    const fields = {
        ratingFrom: 'vote_average.gte', ratingTo: 'vote_average.lte', minVotes: 'vote_count.gte',
        runtimeFrom: 'with_runtime.gte', runtimeTo: 'with_runtime.lte',
    } as const;
    for (const [field, parameter] of Object.entries(fields)) {
        const value = filters[field as keyof typeof fields];
        if (value !== '') params[parameter] = Number(value);
    }
    return {path: '/discover/movie', params};
}

/** 优先使用浏览器中文名称，其次查本地映射，再回退接口名称或语言代码。 */
export function discoveryLanguageLabel(code: string, fallback = code): string {
    try {
        const label = new Intl.DisplayNames(['zh-CN'], {type: 'language'}).of(code)?.trim();
        // 未识别的代码可能原样返回；缺少中文语言数据时还可能返回英文名称。
        if (label && label.toLowerCase() !== code.toLowerCase() && /\p{Script=Han}/u.test(label)) return label;
    } catch {
        // 浏览器不支持该功能或代码无效时，继续使用本地映射。
    }
    if (Object.hasOwn(LANGUAGE_NAMES_ZH, code)) return LANGUAGE_NAMES_ZH[code];
    return fallback.trim() || code;
}
