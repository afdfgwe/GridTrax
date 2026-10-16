import axios from 'axios';
import type {
    TMDBMovie,
    TMDBSearchResult,
    TMDBSeason,
    TMDBTVShow,
} from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
const ENV_BEARER = import.meta.env.VITE_TMDB_BEARER as string;

const tmdbAxios = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json;charset=utf-8',
        ...(ENV_BEARER ? {Authorization: `Bearer ${ENV_BEARER}`} : {}),
    },
});

export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const getPosterUrl = (path?: string, size = 'w342') =>
    path ? `${IMAGE_BASE}${size}${path}` : '/placeholder-poster.svg';
export const getBackdropUrl = (path?: string, size = 'w1280') =>
    path ? `${IMAGE_BASE}${size}${path}` : '';

// Search multi (movies + TV)
export async function searchMulti(query: string, page = 1): Promise<TMDBSearchResult[]> {
    const res = await tmdbAxios.get('/search/multi', {
        params: {query, page, language: 'zh-CN', include_adult: false},
    });
    return (res.data.results as TMDBSearchResult[]).filter(
        (r) => r.media_type === 'tv' || r.media_type === 'movie'
    );
}

// TV Detail
export async function getTVShow(tvId: number): Promise<TMDBTVShow> {
    const res = await tmdbAxios.get(`/tv/${tvId}`, {
        params: {language: 'zh-CN'},
    });
    return res.data as TMDBTVShow;
}

// Season Detail (with episodes)
export async function getTVSeason(tvId: number, seasonNumber: number): Promise<TMDBSeason> {
    const res = await tmdbAxios.get(`/tv/${tvId}/season/${seasonNumber}`, {
        params: {language: 'zh-CN'},
    });
    return res.data as TMDBSeason;
}

// Movie Detail
export async function getMovie(movieId: number): Promise<TMDBMovie> {
    const res = await tmdbAxios.get(`/movie/${movieId}`, {
        params: {language: 'zh-CN'},
    });
    return res.data as TMDBMovie;
}
