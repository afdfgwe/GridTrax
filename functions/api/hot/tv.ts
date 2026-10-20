import {createHotHandler} from '../../../server/hotMovies';

const handle = createHotHandler('tv');

interface EdgeCache {
    match(request: Request): Promise<Response | undefined>;

    put(request: Request, response: Response): Promise<void>;
}

/** 电视剧榜单使用独立缓存键，不与电影榜单互相覆盖。 */
export async function onRequest(context: { request: Request; waitUntil(promise: Promise<unknown>): void }) {
    if (context.request.method !== 'GET') return handle(context.request);
    const key = new Request(new URL('/api/hot/tv', context.request.url));
    const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
    const cached = await cache?.match(key).catch(() => undefined);
    if (cached) return cached;
    const response = await handle(context.request);
    if (response.ok && cache) context.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
    return response;
}
