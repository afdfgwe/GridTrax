import type {HotMovie, MovieSearchItem} from '../types/hotMovies.ts';

/** 忽略空白、标点和不可见方向标记，但保留数字，避免混淆续集。 */
export function normalizeMovieTitle(title: string): string {
    return title.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\p{Cf}\s]/gu, '');
}

/** 仅匹配片名相同且年份相符的唯一候选；允许不同地区上映年份相差一年。 */
export function matchHotMovie(item: HotMovie, results: MovieSearchItem[]): MovieSearchItem | undefined {
    const names = new Set([item.title, item.originalTitle].filter((name): name is string => !!name).map(normalizeMovieTitle));
    const unique = [...new Map(results.map(movie => [movie.id, movie])).values()];
    const candidates = unique.filter(movie => Number.isInteger(movie.id) && movie.id > 0
        && [movie.title, movie.original_title].some(name => !!name && names.has(normalizeMovieTitle(name))));
    if (!item.year) return candidates.length === 1 ? candidates[0] : undefined;
    const year = Number(item.year);
    const sameYear = candidates.filter(movie => movie.release_date?.slice(0, 4) === item.year);
    if (sameYear.length) return sameYear.length === 1 ? sameYear[0] : undefined;
    const nearby = candidates.filter(movie => /^\d{4}-/.test(movie.release_date ?? '')
        && Math.abs(Number(movie.release_date!.slice(0, 4)) - year) === 1);
    return nearby.length === 1 ? nearby[0] : undefined;
}

/** 中文名未找到时再搜索原片名；不按搜索热度盲选第一条。 */
export async function resolveHotMovie(
    item: HotMovie,
    search: (query: string, signal: AbortSignal) => Promise<MovieSearchItem[]>,
    signal: AbortSignal,
): Promise<MovieSearchItem | undefined> {
    signal.throwIfAborted();
    const results = await search(item.title, signal);
    signal.throwIfAborted();
    const match = matchHotMovie(item, results);
    if (match || !item.originalTitle || normalizeMovieTitle(item.title) === normalizeMovieTitle(item.originalTitle)) return match;
    const originalResults = await search(item.originalTitle, signal);
    signal.throwIfAborted();
    return matchHotMovie(item, [...results, ...originalResults]);
}
