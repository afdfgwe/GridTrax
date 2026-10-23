import type {TMDBPersonCombinedCredits, TMDBPersonCredit} from '../types/index.ts';
import {getCreditJobLabel} from './movieCredits.ts';

export interface PersonWork {
    key: string;
    id: number;
    mediaType: 'movie' | 'tv';
    title: string;
    posterPath?: string;
    date: string;
    year: string;
    score?: number;
    cast: boolean;
    characters: string[];
    jobs: string[];
}

/** 仅接受真实日历日期，缺失或异常值统一归入未知年份，不推测上映时间。 */
function creditDate(value?: string | null): string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return '';
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : '';
}

/** 按作品而非 credit_id 去重，保留所有角色与职务；只缓存履历需要的轻量字段。 */
export function normalizePersonCredits(data: TMDBPersonCombinedCredits): PersonWork[] {
    const works = new Map<string, PersonWork>();
    const add = (credit: TMDBPersonCredit, cast: boolean, detail?: string | null) => {
        if (!Number.isSafeInteger(credit.id) || credit.id <= 0
            || !['movie', 'tv'].includes(credit.media_type)) return;
        const movie = credit.media_type === 'movie';
        const title = movie ? credit.title?.trim() || credit.original_title?.trim()
            : credit.name?.trim() || credit.original_name?.trim();
        if (!title) return;
        const key = `${credit.media_type}:${credit.id}`;
        const date = creditDate(movie ? credit.release_date : credit.first_air_date);
        let work = works.get(key);
        if (!work) {
            work = {
                key, id: credit.id, mediaType: credit.media_type, title, date, year: date.slice(0, 4),
                cast: false, characters: [], jobs: []
            };
            works.set(key, work);
        }
        // 重复条目可补齐海报、日期与评分，不让后一条空值覆盖已取得的资料。
        work.posterPath ||= credit.poster_path?.trim() || undefined;
        if (!work.date && date) {
            work.date = date;
            work.year = date.slice(0, 4);
        }
        if (work.score === undefined && Number.isFinite(credit.vote_average)
            && credit.vote_average! > 0 && credit.vote_average! <= 10) work.score = credit.vote_average;
        if (cast) {
            work.cast = true;
            const character = detail?.trim();
            if (character && !work.characters.includes(character)) work.characters.push(character);
        } else {
            const job = getCreditJobLabel(detail);
            if (!work.jobs.includes(job)) work.jobs.push(job);
        }
    };
    for (const credit of data.cast) add(credit, true, credit.character);
    for (const credit of data.crew) add(credit, false, credit.job);
    return [...works.values()];
}

/** 最新年份和日期在前，日期缺失的作品置底；筛选始终保留该作品完整的职务信息。 */
export function groupPersonWorks(works: readonly PersonWork[], filters: {
    mediaType?: 'all' | 'movie' | 'tv'; job?: string; year?: string;
} = {}): { year: string; works: PersonWork[] }[] {
    const filtered = works.filter(work => (!filters.mediaType || filters.mediaType === 'all'
            || work.mediaType === filters.mediaType)
        && (!filters.job || (filters.job === '出演' ? work.cast : work.jobs.includes(filters.job)))
        && (!filters.year || work.year === filters.year || (filters.year === 'unknown' && !work.year)));
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date)
        || a.title.localeCompare(b.title, 'zh-CN') || a.key.localeCompare(b.key));
    const groups = new Map<string, PersonWork[]>();
    for (const work of sorted) {
        const group = groups.get(work.year) ?? [];
        group.push(work);
        groups.set(work.year, group);
    }
    return [...groups].map(([year, works]) => ({year, works}));
}
