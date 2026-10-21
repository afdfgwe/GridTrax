import {createHotMoviesHandler} from '../../../server/hotMovies';

// 在模块级创建处理器，使同一运行实例内的请求能够共享缓存和进行中的上游请求。
const handle = createHotMoviesHandler();

// 用最小结构描述运行时缓存，不给前端引入 Worker 专属全局类型。
interface EdgeCache {
    match(request: Request): Promise<Response | undefined>;

    put(request: Request, response: Response): Promise<void>;
}

/** Pages 自动将此文件映射到 /api/hot/movies；查询参数不能改变上游地址。 */
export async function onRequest(context: { request: Request; waitUntil(promise: Promise<unknown>): void }) {
    if (context.request.method !== 'GET') return handle(context.request);
    const key = new Request(new URL('/api/hot/movies', context.request.url));
    const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
    // 边缘缓存不可用或读取失败时直接回源，不让缓存故障阻断榜单。
    const cached = await cache?.match(key).catch(() => undefined);
    if (cached) return cached;
    const response = await handle(context.request);
    // 复制响应供后台写缓存，避免缓存读取响应体后导致前端收到空内容。
    if (response.ok && cache) context.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
    return response;
}
