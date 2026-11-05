import type {ProgressRecord, TMDBCountry} from '../../types/index.ts';
import {getMediaMetadataKey, type MediaMetadata} from '../media/mediaMetadataCache.ts';
import {getMediaYearKey} from '../media/mediaYears.ts';
import {discoveryLanguageLabel} from '../browse/movieDiscovery.ts';
import {buildWatchedGenreStats, getWatchedRecords, type WatchedGenreRow, type WatchedKind} from './watchedGenres.ts';
import {buildWatchedScoreStats} from './watchedScores.ts';

export type WatchedDimension = 'genre' | 'country' | 'year' | 'language' | 'score';
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

/** 地区按制片归属、年份按上映/首播年、语言按对白语言分别计数，不使用操作时间。 */
export function buildWatchedStats(
    records: readonly ProgressRecord[], metadata: Record<string, MediaMetadata>, kind: WatchedKind = 'all',
    dimension: WatchedDimension = 'genre', countries: readonly TMDBCountry[] = [],
) {
    if (dimension === 'score') return buildWatchedScoreStats(records, metadata, kind);
    if (dimension === 'genre') {
        const base = buildWatchedGenreStats(records, metadata, kind);
        return {
            ...base,
            coverageCount: base.genreCount,
            assignments: base.rows.reduce((sum, row) => sum + row.records.length, 0)
        };
    }
    const watched = getWatchedRecords(records).filter(record => kind === 'all' || record.type === kind);
    const included: ProgressRecord[] = [];
    const names = new Map(countries.map(country => [country.iso_3166_1.trim().toUpperCase(), country.native_name?.trim() || country.english_name?.trim()]));
    const groups = new Map<string, WatchedGenreRow>();
    let resolved = 0;
    for (const record of watched) {
        const data = metadata[getMediaMetadataKey(record)];
        if (!data || (dimension === 'country' && data.countries === undefined) ||
            (dimension === 'language' && data.spokenLanguages === undefined)) continue;
        resolved++;
        const labels = new Map<string, string>();
        if (dimension === 'country') {
            for (const country of data.countries ?? []) {
                labels.set(country.iso_3166_1, countryLabel(country.iso_3166_1, country.name, names));
            }
        } else if (dimension === 'language') {
            for (const language of data.spokenLanguages ?? []) {
                const code = language.iso_639_1;
                const name = /\p{Script=Han}/u.test(language.name) ? language.name
                    : discoveryLanguageLabel(code, language.name || language.english_name || code);
                labels.set(code, name);
            }
        } else {
            const year = data.years[getMediaYearKey(record)];
            if (year && /^\d{4}$/.test(year)) labels.set(year, year);
        }
        // 各维度独立排除空值，不因缺少类型而丢失已有地区、年份或语言的影片。
        if (!labels.size) continue;
        included.push(record);
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
    const denominator = dimension === 'country' ? assignments : included.length;
    const rows = [...groups.values()].map(row => ({...row, share: denominator ? row.records.length / denominator : 0}));
    rows.sort((a, b) => dimension === 'year'
        ? Number(a.key) - Number(b.key)
        : b.records.length - a.records.length || a.name.localeCompare(b.name, 'zh-CN'));
    const movies = included.filter(record => record.type === 'movie').length;
    return {
        records: included, rows, resolved, assignments, coverageCount: rows.length,
        sourceTotal: watched.length, total: included.length, movies, seasons: included.length - movies,
        shows: new Set(included.filter(record => record.type === 'tv_season').map(record => record.tmdb_id)).size,
    };
}
