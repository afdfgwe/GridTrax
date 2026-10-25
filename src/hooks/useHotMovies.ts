import {useEffect, useState} from 'react';
import {
    getCountries,
    getGenres,
    getMovieList,
    getTrendingMovies,
    getTrendingPeople,
    getTrendingTVShows,
    getTVList,
    searchMovies,
    searchTV
} from '../api/tmdb';
import type {TMDBCountry, TMDBGenre} from '../types';
import type {
    HotRow,
    HotFeed,
    HotCategory,
    HotSource,
    MovieListKind,
    TrendingWindow,
    TVListSelection
} from '../types/hotMovies';
import {resolveHotMovie} from '../utils/hotMovieMatch';
import {requestErrorMessage} from '../utils/requestError';
import {resolveHotCategory, toTrendingPersonRows, toTrendingRows} from '../utils/trendingMovies';
import {resolveTVListPage} from '../utils/tvLists';

// 列表、页码和重试次数共同标识一次加载，避免翻页或切换后被旧响应覆盖。
interface Result {
    key: string;
    totalPages?: number;
    feed?: HotFeed;
    rows: HotRow[];
    genres?: TMDBGenre[];
    genreError?: string;
    countries?: TMDBCountry[];
    countryError?: string;
    error?: string;
}

/** 豆瓣五路并发补全；TMDB 趋势榜或影视列表直接展示，切换时取消旧请求。 */
export function useHotMovies(category: HotCategory, source: HotSource = 'douban', timeWindow: TrendingWindow = 'day',
                             options: { tvList?: TVListSelection; movieList?: MovieListKind; page?: number } = {}) {
    const kind = resolveHotCategory(category, source);
    const tvList = source === 'tmdb' && kind === 'tv' ? options.tvList ?? 'trending' : 'trending';
    const movieList = source === 'tmdb' && kind === 'movie' ? options.movieList : undefined;
    const page = tvList !== 'trending' || movieList ? resolveTVListPage(options.page ?? 1) : 1;
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<Result>();
    const [pagination, setPagination] = useState<{ key: string; totalPages: number }>();
    const paginationKey = `${source}:${kind}:${timeWindow}:${tvList}:${movieList ?? ''}`;
    const requestKey = `${paginationKey}:${page}:${attempt}`;
    useEffect(() => {
        const controller = new AbortController();
        const {signal} = controller;

        async function load() {
            if (source === 'tmdb') {
                // 字典与影视榜单并行获取；人物不请求影视类型或地区字典。
                const genresRequest = kind !== 'person' ? getGenres(kind).then(
                    genres => ({genres, genreError: undefined}),
                    error => ({genres: [], genreError: requestErrorMessage(error)}),
                ) : Promise.resolve({genres: [], genreError: undefined});
                const countriesRequest = kind === 'tv' ? getCountries().then(
                    countries => ({countries, countryError: undefined}),
                    error => ({countries: [], countryError: requestErrorMessage(error)}),
                ) : Promise.resolve({countries: [], countryError: undefined});
                try {
                    let rows: HotRow[];
                    let totalPages: number | undefined;
                    if (kind === 'movie' && movieList) {
                        const list = await getMovieList(movieList, page, signal);
                        rows = toTrendingRows(list.results, (list.page - 1) * 20);
                        totalPages = list.total_pages;
                    } else if (kind === 'tv' && tvList !== 'trending') {
                        const list = await getTVList(tvList, page, signal);
                        rows = toTrendingRows(list.results, (list.page - 1) * 20);
                        totalPages = list.total_pages;
                    } else if (kind === 'person') {
                        const people = await getTrendingPeople(timeWindow, signal);
                        if (!Array.isArray(people)) throw new Error('榜单格式错误');
                        rows = toTrendingPersonRows(people);
                    } else {
                        const movies = await (kind === 'movie' ? getTrendingMovies : getTrendingTVShows)(timeWindow, signal);
                        if (!Array.isArray(movies)) throw new Error('榜单格式错误');
                        rows = toTrendingRows(movies);
                    }
                    if (signal.aborted) return;
                    if (totalPages !== undefined) setPagination({key: paginationKey, totalPages});
                    setResult({
                        key: requestKey, totalPages, rows, feed: {
                            items: rows.map(row => row.item), fetchedAt: new Date().toISOString(),
                        }
                    });
                    const updateMetadata = (metadata: Pick<Result, 'genres' | 'genreError' | 'countries' | 'countryError'>) => {
                        if (!signal.aborted) setResult(previous => previous?.key === requestKey
                            ? {...previous, ...metadata} : previous);
                    };
                    // 字典完成后各自更新，不让较慢的接口阻塞另一个字典的展示。
                    await Promise.all([genresRequest.then(updateMetadata), countriesRequest.then(updateMetadata)]);
                } catch (error) {
                    if (!signal.aborted) setResult({
                        key: requestKey, rows: [],
                        error: `TMDB 榜单暂时无法加载。${requestErrorMessage(error)}`
                    });
                }
                return;
            }
            let feed: HotFeed;
            try {
                const response = await fetch(kind === 'movie' ? '/api/hot/movies' : '/api/hot/tv', {signal});
                if (!response.ok) throw new Error('榜单接口不可用');
                feed = await response.json() as HotFeed;
                if (!Array.isArray(feed.items) || !feed.items.length) throw new Error('榜单为空');
            } catch {
                if (!signal.aborted) setResult({
                    key: requestKey,
                    rows: [],
                    error: '豆瓣榜单暂时无法加载，请稍后重试。'
                });
                return;
            }
            if (signal.aborted) return;
            setResult({
                key: requestKey,
                feed,
                rows: feed.items.map(item => ({item, status: 'loading'}))
            });
            // 五个工作循环共用下一个索引；每个循环完成一条后立即领取下一条，避免按批等待慢请求。
            let next = 0;

            async function worker() {
                while (!signal.aborted && next < feed.items.length) {
                    const index = next++;
                    const item = feed.items[index];
                    let row: HotRow;
                    try {
                        const movie = await resolveHotMovie(item, kind === 'movie' ? searchMovies : searchTV, signal);
                        row = {item, movie, status: movie ? 'matched' : 'unmatched'};
                    } catch (error) {
                        row = {item, status: 'error', error: requestErrorMessage(error)};
                    }
                    if (signal.aborted) return;
                    // 按原始索引替换，不让请求完成顺序改变豆瓣排名。
                    setResult(previous => previous?.key === requestKey ? {
                        ...previous, rows: previous.rows.map((value, position) => position === index ? row : value),
                    } : previous);
                }
            }

            await Promise.all(Array.from({length: Math.min(5, feed.items.length)}, worker));
        }

        void load();
        return () => controller.abort();
    }, [kind, source, timeWindow, tvList, movieList, page, paginationKey, requestKey]);
    // 切换选项后不展示上一组结果；榜单已返回但仍在补全资料时，用 matching 单独提示进度。
    const current = result?.key === requestKey ? result : undefined;
    return {
        rows: current?.rows ?? [],
        genres: current?.genres ?? [],
        genreError: current?.genreError,
        countries: current?.countries ?? [],
        countryError: current?.countryError,
        fetchedAt: current?.feed?.fetchedAt,
        // 同一列表翻页时保留已知总页数，避免加载期间分母跳变；不同列表不混用。
        totalPages: current?.totalPages ?? (pagination?.key === paginationKey ? pagination.totalPages : undefined),
        error: current?.error,
        loading: !current,
        matching: current?.rows.some(row => row.status === 'loading') ?? false,
        refresh: () => setAttempt(value => value + 1),
    };
}
