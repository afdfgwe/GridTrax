import type {HotFeed, HotItem, HotKind} from '../src/types/hotMovies.ts';

const COLLECTIONS = {
    movie: 'movie_real_time_hotest',
    tv: 'tv_real_time_hotest',
} as const;
const CACHE_MS = 5 * 60_000;

function object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
    // 去掉上游偶尔夹带的不可见格式字符，避免标题匹配和页面对齐受到干扰。
    return typeof value === 'string' ? value.replace(/\p{Cf}/gu, '').trim() : '';
}

/** 上游的 score 是热度，不是评分；无评分的 0 值不展示为 0.0。 */
export function parseHotItems(data: unknown, kind: HotKind): HotItem[] {
    const raw = object(data).subject_collection_items;
    if (!Array.isArray(raw)) throw new Error('Invalid Douban response');
    const seen = new Set<string>();
    const items: HotItem[] = [];
    for (const [index, value] of raw.slice(0, 10).entries()) {
        const item = object(value);
        const id = String(item.id ?? '');
        const title = text(item.title);
        if (!/^\d+$/.test(id) || !title || item.type !== kind || seen.has(id)) continue;
        seen.add(id);
        const rating = object(item.rating).value;
        const year = String(item.year ?? '');
        items.push({
            id, title,
            rank: Number.isInteger(item.rank) && Number(item.rank) > 0 && Number(item.rank) <= 10
                ? Number(item.rank) : index + 1,
            originalTitle: text(item.original_title) || undefined,
            year: /^\d{4}$/.test(year) ? year : undefined,
            info: text(item.info) || undefined,
            rating: typeof rating === 'number' && Number.isFinite(rating) && rating > 0 && rating <= 10
                ? rating : undefined,
        });
    }
    if (!items.length) throw new Error('Empty Douban response');
    return items.sort((a, b) => a.rank - b.rank);
}

export const parseHotMovies = (data: unknown) => parseHotItems(data, 'movie');

/** 固定上游地址防止接口变成任意代理；成功缓存，失败不缓存，并合并并发请求。 */
export function createHotHandler(kind: HotKind, fetcher: typeof fetch = fetch, now = Date.now) {
    const collection = COLLECTIONS[kind];
    const upstream = `https://m.douban.com/rexxar/api/v2/subject_collection/${collection}/items?type=${kind}&start=0&count=10&for_mobile=1`;
    // 缓存和进行中的请求属于当前处理器实例，电影与电视剧分别创建实例。
    let cached: { feed: HotFeed; expires: number } | undefined;
    let pending: Promise<HotFeed> | undefined;

    async function load(): Promise<HotFeed> {
        const response = await fetcher(upstream, {
            headers: {Accept: 'application/json', Referer: `https://m.douban.com/subject_collection/${collection}`},
            signal: AbortSignal.timeout(12_000),
            // Workers 不支持 redirect:error，使用 manual 并由下方状态检查拒绝重定向。
            redirect: 'manual',
        });
        if (!response.ok) throw response;
        const items = parseHotItems(await response.json(), kind);
        const feed = {items, fetchedAt: new Date(now()).toISOString()};
        cached = {feed, expires: now() + CACHE_MS};
        return feed;
    }

    return async (request: Request): Promise<Response> => {
        if (request.method !== 'GET') {
            return Response.json({error: '仅支持 GET 请求。'}, {
                status: 405,
                headers: {Allow: 'GET', 'Cache-Control': 'no-store'}
            });
        }
        try {
            const feed = cached && cached.expires > now() ? cached.feed
                : await (pending ??= load().finally(() => {
                    pending = undefined;
                }));
            // 边缘缓存只继承剩余有效期，命中内存缓存不能重新延长五分钟。
            const ttl = Math.max(0, Math.floor(((cached?.expires ?? now()) - now()) / 1000));
            return Response.json(feed, {
                headers: {
                    'Cache-Control': `public, max-age=0, s-maxage=${ttl}`,
                    'X-Content-Type-Options': 'nosniff',
                }
            });
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

/** 电影榜单处理器：与电视剧各自持有独立的上游地址与缓存实例。 */
export const createHotMoviesHandler = (fetcher: typeof fetch = fetch, now = Date.now) => createHotHandler('movie', fetcher, now);
