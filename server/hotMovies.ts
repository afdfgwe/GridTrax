import type {HotMovie, HotMoviesFeed} from '../src/types/hotMovies.ts';

const UPSTREAM = 'https://m.douban.com/rexxar/api/v2/subject_collection/movie_real_time_hotest/items?type=movie&start=0&count=10&for_mobile=1';
const CACHE_MS = 5 * 60_000;

function object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\p{Cf}/gu, '').trim() : '';
}

/** 上游的 score 是热度，不是评分；无评分的 0 值不展示为 0.0。 */
export function parseHotMovies(data: unknown): HotMovie[] {
    const raw = object(data).subject_collection_items;
    if (!Array.isArray(raw)) throw new Error('Invalid Douban response');
    const seen = new Set<string>();
    const items: HotMovie[] = [];
    for (const [index, value] of raw.slice(0, 10).entries()) {
        const item = object(value);
        const id = String(item.id ?? '');
        const title = text(item.title);
        if (!/^\d+$/.test(id) || !title || item.type !== 'movie' || seen.has(id)) continue;
        seen.add(id);
        const rating = object(item.rating).value;
        const year = String(item.year ?? '');
        items.push({
            id, title,
            rank: Number.isInteger(item.rank) && Number(item.rank) > 0 && Number(item.rank) <= 10
                ? Number(item.rank) : index + 1,
            originalTitle: text(item.original_title) || undefined,
            year: /^\d{4}$/.test(year) ? year : undefined,
            rating: typeof rating === 'number' && Number.isFinite(rating) && rating > 0 && rating <= 10
                ? rating : undefined,
        });
    }
    if (!items.length) throw new Error('Empty Douban response');
    return items.sort((a, b) => a.rank - b.rank);
}

/** 固定上游地址防止接口变成任意代理；成功缓存，失败不缓存，并合并并发请求。 */
export function createHotMoviesHandler(fetcher: typeof fetch = fetch, now = Date.now) {
    let cached: {feed: HotMoviesFeed; expires: number} | undefined;
    let pending: Promise<HotMoviesFeed> | undefined;

    async function load(): Promise<HotMoviesFeed> {
        const response = await fetcher(UPSTREAM, {
            headers: {Accept: 'application/json', Referer: 'https://m.douban.com/subject_collection/movie_real_time_hotest'},
            signal: AbortSignal.timeout(12_000),
            // Workers 不支持 redirect:error，使用 manual 并由下方状态检查拒绝重定向。
            redirect: 'manual',
        });
        if (!response.ok) throw response;
        const items = parseHotMovies(await response.json());
        const feed = {items, fetchedAt: new Date(now()).toISOString()};
        cached = {feed, expires: now() + CACHE_MS};
        return feed;
    }

    return async (request: Request): Promise<Response> => {
        if (request.method !== 'GET') {
            return Response.json({error: '仅支持 GET 请求。'}, {status: 405, headers: {Allow: 'GET', 'Cache-Control': 'no-store'}});
        }
        try {
            const feed = cached && cached.expires > now() ? cached.feed
                : await (pending ??= load().finally(() => { pending = undefined; }));
            const ttl = Math.max(0, Math.floor(((cached?.expires ?? now()) - now()) / 1000));
            return Response.json(feed, {headers: {
                'Cache-Control': `public, max-age=0, s-maxage=${ttl}`,
                'X-Content-Type-Options': 'nosniff',
            }});
        } catch (error) {
            // 仅记录状态或错误类别，方便 Pages 日志排查；不输出上游正文和用户资料。
            console.warn('豆瓣热门榜请求失败', error instanceof Response ? `HTTP ${error.status}`
                : error instanceof Error ? error.name : 'UnknownError');
            const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
            return Response.json({error: timeout ? '豆瓣榜单请求超时，请稍后重试。' : '豆瓣榜单暂时不可用，请稍后重试。'}, {
                status: timeout ? 504 : 502, headers: {'Cache-Control': 'no-store'},
            });
        }
    };
}
