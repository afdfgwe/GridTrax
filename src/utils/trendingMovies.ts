import type {HotCategory, HotRow, HotSource, TrendingMovie, TrendingPerson, TrendingTVShow} from '../types/hotMovies.ts';
import type {TMDBCountry, TMDBGenre} from '../types/index.ts';

// 中文类型接口仍可能返回这两个英文名称，仅补齐对应翻译，不覆盖已有中文名称。
const genreTranslations: Readonly<Record<string, string>> = {
    'Sci-Fi & Fantasy': '科幻与奇幻',
    'War & Politics': '战争与政治',
};

/** 豆瓣没有人物榜；来源切回豆瓣或网址参数无效时安全回退到电影榜。 */
export function resolveHotCategory(value: string | null, source: HotSource): HotCategory {
    return value === 'tv' ? 'tv' : value === 'person' && source === 'tmdb' ? 'person' : 'movie';
}

/** 人物独立保存在 person 字段，不混入影视评分、年份和类型字典。 */
export function toTrendingPersonRows(people: TrendingPerson[]): HotRow[] {
    return people.map((person, index) => ({
        item: {
            id: String(person.id), rank: index + 1,
            title: person.name?.trim() || person.original_name?.trim() || '未知人物',
        },
        person,
        status: 'matched',
    }));
}

/** 代表作品按接口顺序去重，只保留有效电影和电视剧，避免生成错误详情链接。 */
export function getTrendingPersonWorks(person: TrendingPerson) {
    return (person.known_for ?? []).filter(work =>
        (work.media_type === 'movie' || work.media_type === 'tv') &&
        Number.isSafeInteger(work.id) && work.id > 0 && (work.title?.trim() || work.name?.trim())
    ).filter((work, index, all) => all.findIndex(candidate =>
        candidate.id === work.id && candidate.media_type === work.media_type
    ) === index).map(work => ({
        id: work.id, kind: work.media_type, title: work.title?.trim() || work.name!.trim(),
    }));
}

/** 保持接口排名并复用榜单行结构，不把 TMDB 评分填入豆瓣评分字段。 */
export function toTrendingRows(entries: (TrendingMovie | TrendingTVShow)[]): HotRow[] {
    return entries.map((entry, index) => {
        // 统一标题和日期字段，保留接口原始排名、类型及地区，不额外搜索匹配。
        const movie: TrendingMovie = 'name' in entry ? {
            ...entry, title: entry.name, original_title: entry.original_name, release_date: entry.first_air_date,
        } : entry;
        return {
            item: {
                id: String(movie.id),
                rank: index + 1,
                title: movie.title,
                year: movie.release_date?.match(/^\d{4}(?=-)/)?.[0],
            },
            movie,
            status: 'matched',
        };
    });
}

/** 类型、地区按原始顺序显示名称；未知地区保留代码，缺失资料不占行。 */
export function getTrendingInfo(movie?: TrendingMovie, genres: readonly TMDBGenre[] = [], countries: readonly TMDBCountry[] = []) {
    // 字典查找只做展示转换，不改写原始条目的数字类型 ID 与地区代码。
    const names = new Map(genres.map(genre => {
        const name = genre.name.trim();
        return [genre.id, genreTranslations[name] ?? name];
    }));
    const countryNames = new Map(countries.map(country => [country.iso_3166_1.trim().toUpperCase(),
        country.native_name?.trim() || country.english_name?.trim()]));
    return [
        {label: '上映', value: movie?.release_date?.trim()},
        {
            label: '地区', value: movie?.origin_country?.map(country => {
                const code = country.trim().toUpperCase();
                return code ? countryNames.get(code) || code : '';
            }).filter(Boolean).join(' ')
        },
        {label: '类型', value: movie?.genre_ids?.map(id => names.get(id)).filter(Boolean).join(' ')},
    ].filter(part => part.value);
}
