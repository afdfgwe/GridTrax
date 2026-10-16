/** TMDB 请求和图片地址的统一入口，页面只调用封装函数，不自行拼接鉴权头。 */
import axios from 'axios';
import type {
    TMDBMovie,
    TMDBSearchResult,
    TMDBSeason,
    TMDBTVShow,
} from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
// Vite 在开发或构建时读取该变量；部署后修改变量需要重新构建才能生效。
// VITE_ 前缀变量会进入浏览器代码，不能把这里当作后端私密凭据存储。
const ENV_BEARER = import.meta.env.VITE_TMDB_BEARER as string;

// 共用客户端让搜索、电影详情、电视剧详情都使用同一个 Bearer Token。
const tmdbAxios = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json;charset=utf-8',
        ...(ENV_BEARER ? {Authorization: `Bearer ${ENV_BEARER}`} : {}),
    },
});

// 接口只返回图片路径，实际图片地址由尺寸和路径组成；缺少海报时使用占位地址。
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const getPosterUrl = (path?: string, size = 'w342') =>
    path ? `${IMAGE_BASE}${size}${path}` : '/placeholder-poster.svg';
export const getBackdropUrl = (path?: string, size = 'w1280') =>
    path ? `${IMAGE_BASE}${size}${path}` : '';

/** 多类型搜索；接口还可能返回人物，此封装只向页面返回电影和电视剧。 */
export async function searchMulti(query: string, page = 1): Promise<TMDBSearchResult[]> {
    const res = await tmdbAxios.get('/search/multi', {
        params: {query, page, language: 'zh-CN', include_adult: false},
    });
    return (res.data.results as TMDBSearchResult[]).filter(
        (r) => r.media_type === 'tv' || r.media_type === 'movie'
    );
}

/** 整部电视剧详情，包含剧名、首播日期、评分和 seasons 季摘要。 */
export async function getTVShow(tvId: number): Promise<TMDBTVShow> {
    const res = await tmdbAxios.get(`/tv/${tvId}`, {
        params: {language: 'zh-CN'},
    });
    return res.data as TMDBTVShow;
}

/** 单季详情，包含 episodes 数组，供集数标题、排序和观看进度使用。 */
export async function getTVSeason(tvId: number, seasonNumber: number): Promise<TMDBSeason> {
    const res = await tmdbAxios.get(`/tv/${tvId}/season/${seasonNumber}`, {
        params: {language: 'zh-CN'},
    });
    return res.data as TMDBSeason;
}

/** 电影详情，包含片名、上映日期、片长、类型及 TMDB 评分。 */
export async function getMovie(movieId: number): Promise<TMDBMovie> {
    const res = await tmdbAxios.get(`/movie/${movieId}`, {
        params: {language: 'zh-CN'},
    });
    return res.data as TMDBMovie;
}
