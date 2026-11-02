import type {ProgressRecord, TMDBCountry} from '../types/index.ts';
import {getMediaMetadataKey, type MediaMetadata} from './mediaMetadataCache.ts';
import {getMediaYearKey} from './mediaYears.ts';
import {buildWatchedGenreStats, UNKNOWN_GENRE, type WatchedGenreRow, type WatchedKind} from './watchedGenres.ts';

export type WatchedDimension = 'genre' | 'country' | 'year';
export const UNKNOWN_STAT = 'unknown';

/** 制片地区优先使用接口中文字典，字典不可用时使用浏览器中文名称，最后保留原名称。 */
function countryLabel(code: string, fallback: string, names: Map<string, string>) {
    if (names.get(code)) return names.get(code)!;
    try {
        const label = new Intl.DisplayNames(['zh-CN'], {type: 'region'}).of(code);
        if (label && label !== code) {
            names.set(code, label);
            return label;
        }
    } catch { /* 不支持本地化名称时不阻塞统计。 */
    }
    const label = fallback || code;
    names.set(code, label);
    return label;
}

/** 国家按制片地区归属计数；年份按电影上映年、每季首播年计数，不使用操作时间。 */
export function buildWatchedStats(
    records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedKind = 'all',
    dimension: WatchedDimension = 'genre', countries: readonly TMDBCountry[] = [],
) {
    const base = buildWatchedGenreStats(records, metadata, kind);
    if (dimension === 'genre') return {
        ...base,
        coverageCount: base.genreCount,
        assignments: base.rows.reduce((sum, row) => sum + row.records.length, 0)
    };
    const names = new Map(countries.map(country => [country.iso_3166_1.trim().toUpperCase(), country.native_name?.trim() || country.english_name?.trim()]));
    const groups = new Map<string, WatchedGenreRow>();
    let resolved = 0;
    for (const record of base.records) {
        const data = metadata[getMediaMetadataKey(record)];
        if (!data || (dimension === 'country' && data.countries === undefined)) continue;
        resolved++;
        const labels = new Map<string, string>();
        if (dimension === 'country') {
            for (const country of data.countries ?? []) {
                labels.set(country.iso_3166_1, countryLabel(country.iso_3166_1, country.name, names));
            }
        } else {
            const year = data.years[getMediaYearKey(record)];
            if (year && /^\d{4}$/.test(year)) labels.set(year, year);
        }
        if (!labels.size) labels.set(UNKNOWN_STAT, dimension === 'country' ? '未标注地区' : '未标注年份');
        for (const [key, name] of labels) {
            const row = groups.get(key) ?? {key, name, records: [], movies: 0, seasons: 0, share: 0};
            row.records.push(record);
            if (record.type === 'movie') row.movies++;
            else row.seasons++;
            groups.set(key, row);
        }
    }
    const assignments = [...groups.values()].reduce((sum, row) => sum + row.records.length, 0);
    // 环形图的分母必须是地区归属次数，不能把多国合拍伪装成互斥的作品占比。
    const denominator = dimension === 'country' ? assignments : base.total;
    const rows = [...groups.values()].map(row => ({...row, share: denominator ? row.records.length / denominator : 0}));
    rows.sort((a, b) => dimension === 'year'
        ? (a.key === UNKNOWN_STAT ? 1 : b.key === UNKNOWN_STAT ? -1 : Number(a.key) - Number(b.key))
        : b.records.length - a.records.length || a.name.localeCompare(b.name, 'zh-CN'));
    return {...base, rows, resolved, assignments, coverageCount: rows.filter(row => row.key !== UNKNOWN_GENRE).length};
}
