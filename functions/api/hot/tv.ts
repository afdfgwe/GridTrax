import {createHotHandler} from '../../../server/hotMovies';

// 模块级处理器复用电视剧榜的内存缓存，不能放到每次请求内部重新创建。
const handle = createHotHandler('tv');

// 用最小结构描述运行时缓存，不给前端引入 Worker 专属全局类型。
interface EdgeCache {
    match(request: Request): Promise<Response | undefined>;

    put(request: Request, response: Response): Promise<void>;
}

/** 电视剧榜单使用独立缓存键，不与电影榜单互相覆盖。 */
export async function onRequest(context: { request: Request; waitUntil(promise: Promise<unknown>): void }) {
    if (context.request.method !== 'GET') return handle(context.request);
    const key = new Request(new URL('/api/hot/tv', context.request.url));
    // 兼容没有 Cloudflare Cache API 的运行环境，缓存缺失时仍可正常请求上游。
    const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
    const cached = await cache?.match(key).catch(() => undefined);
    if (cached) return cached;
    const response = await handle(context.request);
    // 仅缓存成功响应；克隆响应体并交给 waitUntil，不阻塞当前响应返回。
    if (response.ok && cache) context.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
    return response;
}
