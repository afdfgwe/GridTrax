/** TMDB 请求和图片地址的统一入口，页面只调用封装函数，不自行拼接鉴权头。 */
import axios from 'axios';
import type {HotKind, HotSearchItem, TrendingMovie, TrendingTVShow, TrendingWindow} from '../types/hotMovies';
import {createRequestCache} from '../utils/requestCache';
import {normalizeTVAggregateCredits} from '../utils/movieCredits';
import type {
    TMDBCountry,
    TMDBGenre,
    TMDBMovie,
    TMDBCredits,
    TMDBSearchResult,
    TMDBSeason,
    TMDBTVShow,
    TMDBTVAggregateCredits,
    TMDBTVRecommendations,
} from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
// Vite 在开发或构建时读取该变量；部署后修改变量需要重新构建才能生效。
// VITE_ 前缀变量会进入浏览器代码，不能把这里当作后端私密凭据存储。
const ENV_BEARER = import.meta.env.VITE_TMDB_BEARER as string;

// 共用客户端让搜索、电影详情、电视剧详情都使用同一个 Bearer Token。
const tmdbAxios = axios.create({
    baseURL: BASE_URL,
    timeout: 15_000,
    headers: {
        'Content-Type': 'application/json;charset=utf-8',
        ...(ENV_BEARER ? {Authorization: `Bearer ${ENV_BEARER}`} : {}),
    },
});

// 缓存只保存在内存，不写入观影记录；单个页面卸载不能取消其他页面共用的请求。
const detailsCache = createRequestCache<TMDBMovie | TMDBTVShow | TMDBSeason>();
// 类型字典变更较少，缓存一天并共享进行中的请求，不随单个榜单的取消而中断。
const genresCache = createRequestCache<TMDBGenre[]>(2, 24 * 60 * 60_000);
const countriesCache = createRequestCache<TMDBCountry[]>(1, 24 * 60 * 60_000);
const creditsCache = createRequestCache<TMDBCredits>(40);
const recommendationsCache = createRequestCache<TMDBTVRecommendations>(40);

// 请求路径含作品类型、作品 ID 和季号，可直接作为详情缓存键，避免不同资源相互覆盖。
function getDetails<T extends TMDBMovie | TMDBTVShow | TMDBSeason>(path: string): Promise<T> {
    return detailsCache.load(path, async () => {
        const res = await tmdbAxios.get<T>(path, {params: {language: 'zh-CN'}});
        return res.data;
    }) as Promise<T>;
}

// 接口只返回图片路径，实际图片地址由尺寸和路径组成；缺少海报时使用占位地址。
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const getPosterUrl = (path?: string, size = 'w342') =>
    path ? `${IMAGE_BASE}${size}${path}` : '/placeholder-poster.svg';
export const getBackdropUrl = (path?: string, size = 'w1280') =>
    path ? `${IMAGE_BASE}${size}${path}` : '';

/** 多类型搜索；接口还可能返回人物，此封装只向页面返回电影和电视剧。 */
export async function searchMulti(query: string, page = 1, signal?: AbortSignal): Promise<{
    results: TMDBSearchResult[]; total_pages: number; page: number;
}> {
    const res = await tmdbAxios.get('/search/multi', {
        params: {query, page, language: 'zh-CN', include_adult: false},
        signal,
    });
    return {
        page: res.data.page,
        // 搜索接口最多允许访问前 500 页，分页控件与接口限制保持一致。
        total_pages: Math.min(res.data.total_pages, 500),
        results: (res.data.results as TMDBSearchResult[]).filter(
            (r) => r.media_type === 'tv' || r.media_type === 'movie'
        ),
    };
}

/** 电影、电视剧分别获取并缓存中文类型，失败结果不缓存，刷新榜单时可重试。 */
export function getGenres(kind: HotKind): Promise<TMDBGenre[]> {
    return genresCache.load(`${kind}:zh-CN`, async () => {
        const res = await tmdbAxios.get<{ genres: TMDBGenre[] }>(`/genre/${kind}/list`, {
            params: {language: 'zh-CN'},
        });
        if (!Array.isArray(res.data.genres)) throw new Error('类型列表格式错误');
        return res.data.genres;
    });
}

/** 地区列表请求中文版本，与类型字典一样共享请求并缓存一天，失败时可重试。 */
export function getCountries(): Promise<TMDBCountry[]> {
    return countriesCache.load('countries:zh-CN', async () => {
        const res = await tmdbAxios.get<TMDBCountry[]>('/configuration/countries', {
            params: {language: 'zh-CN'},
        });
        if (!Array.isArray(res.data)) throw new Error('地区列表格式错误');
        return res.data;
    });
}

/** TMDB 电影日榜、周榜直接返回完整条目，无需再次搜索匹配。 */
export async function getTrendingMovies(timeWindow: TrendingWindow = 'day', signal?: AbortSignal): Promise<TrendingMovie[]> {
    const res = await tmdbAxios.get<{ results: TrendingMovie[] }>(`/trending/movie/${timeWindow}`, {
        params: {language: 'zh-CN', page: 1}, signal,
    });
    return res.data.results;
}

/** 电视剧日榜、周榜直接使用趋势接口，保留首播日期、原名和地区代码。 */
export async function getTrendingTVShows(timeWindow: TrendingWindow = 'day', signal?: AbortSignal): Promise<TrendingTVShow[]> {
    const res = await tmdbAxios.get<{ results: TrendingTVShow[] }>(`/trending/tv/${timeWindow}`, {
        params: {language: 'zh-CN', page: 1}, signal,
    });
    return res.data.results;
}

/** 豆瓣榜单匹配仅搜索电影，避免同名电视剧或人物混入结果。 */
export async function searchMovies(query: string, signal?: AbortSignal): Promise<HotSearchItem[]> {
    const res = await tmdbAxios.get<{ results: HotSearchItem[] }>('/search/movie', {
        params: {query, page: 1, language: 'zh-CN', include_adult: false}, signal,
    });
    return res.data.results;
}

/** 电视剧搜索字段与电影不同，映射后共用严格的片名及年份匹配。 */
export async function searchTV(query: string, signal?: AbortSignal): Promise<HotSearchItem[]> {
    const res = await tmdbAxios.get<{
        results: Array<{
            id: number; name: string; original_name?: string; first_air_date?: string;
            poster_path?: string | null; overview?: string; vote_average?: number;
        }>
    }>('/search/tv', {
        params: {query, page: 1, language: 'zh-CN', include_adult: false}, signal,
    });
    return res.data.results.map(({name, original_name, first_air_date, ...rest}) => ({
        ...rest, title: name, original_title: original_name, release_date: first_air_date,
    }));
}

/** 整部电视剧详情，包含剧名、首播日期、评分和 seasons 季摘要。 */
export async function getTVShow(tvId: number): Promise<TMDBTVShow> {
    return getDetails<TMDBTVShow>(`/tv/${tvId}`);
}

/** 推荐按电视剧和页码独立缓存五分钟，失败不缓存，不额外请求条目详情。 */
export function getTVRecommendations(tvId: number, page = 1): Promise<TMDBTVRecommendations> {
    return recommendationsCache.load(`tv:${tvId}:${page}:zh-CN`, async () => {
        const res = await tmdbAxios.get<TMDBTVRecommendations>(`/tv/${tvId}/recommendations`, {
            params: {language: 'zh-CN', page},
        });
        if (!Array.isArray(res.data.results)) throw new Error('推荐列表格式错误');
        return res.data;
    });
}

/** 单季详情，包含 episodes 数组，供集数标题、排序和观看进度使用。 */
export async function getTVSeason(tvId: number, seasonNumber: number): Promise<TMDBSeason> {
    return getDetails<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`);
}

/** 电影详情，包含片名、上映日期、片长、类型及 TMDB 评分。 */
export async function getMovie(movieId: number): Promise<TMDBMovie> {
    return getDetails<TMDBMovie>(`/movie/${movieId}`);
}

/** 演职员独立加载并缓存五分钟，失败不缓存，也不阻塞电影详情。 */
export function getMovieCredits(movieId: number): Promise<TMDBCredits> {
    return creditsCache.load(`movie:${movieId}:zh-CN`, async () => {
        const res = await tmdbAxios.get<TMDBCredits>(`/movie/${movieId}/credits`, {
            params: {language: 'zh-CN'},
        });
        if (!Array.isArray(res.data.cast) || !Array.isArray(res.data.crew)) {
            throw new Error('演职员列表格式错误');
        }
        return res.data;
    });
}

/** 整剧演职员汇总所有季，转换后共享展示逻辑，缓存键与电影隔离。 */
export function getTVAggregateCredits(tvId: number): Promise<TMDBCredits> {
    return creditsCache.load(`tv:${tvId}:zh-CN`, async () => {
        const res = await tmdbAxios.get<TMDBTVAggregateCredits>(`/tv/${tvId}/aggregate_credits`, {
            params: {language: 'zh-CN'},
        });
        if (!Array.isArray(res.data.cast) || !Array.isArray(res.data.crew)) {
            throw new Error('演职员列表格式错误');
        }
        return normalizeTVAggregateCredits(res.data);
    });
}
