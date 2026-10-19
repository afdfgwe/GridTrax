import {createHotMoviesHandler} from '../../../server/hotMovies';

const handle = createHotMoviesHandler();

// 用最小结构描述运行时缓存，不给前端引入 Worker 专属全局类型。
interface EdgeCache {
    match(request: Request): Promise<Response | undefined>;
    put(request: Request, response: Response): Promise<void>;
}

/** Pages 自动将此文件映射到 /api/hot/movies；查询参数不能改变上游地址。 */
export async function onRequest(context: {request: Request; waitUntil(promise: Promise<unknown>): void}) {
    if (context.request.method !== 'GET') return handle(context.request);
    const key = new Request(new URL('/api/hot/movies', context.request.url));
    const cache = (globalThis as unknown as {caches?: {default?: EdgeCache}}).caches?.default;
    const cached = await cache?.match(key).catch(() => undefined);
    if (cached) return cached;
    const response = await handle(context.request);
    if (response.ok && cache) context.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
    return response;
}
