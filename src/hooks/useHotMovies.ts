import {useEffect, useState} from 'react';
import {getCountries, getGenres, getTrendingMovies, getTrendingTVShows, searchMovies, searchTV} from '../api/tmdb';
import type {TMDBCountry, TMDBGenre} from '../types';
import type {HotRow, HotFeed, HotKind, HotSource, TrendingWindow} from '../types/hotMovies';
import {resolveHotMovie} from '../utils/hotMovieMatch';
import {requestErrorMessage} from '../utils/requestError';
import {toTrendingRows} from '../utils/trendingMovies';

// 来源、类别、时间窗口和重试次数共同标识一次加载，异步回写必须匹配同一组条件。
interface Result {
    source: HotSource;
    kind: HotKind;
    timeWindow: TrendingWindow;
    attempt: number;
    feed?: HotFeed;
    rows: HotRow[];
    genres?: TMDBGenre[];
    genreError?: string;
    countries?: TMDBCountry[];
    countryError?: string;
    error?: string;
}

/** 豆瓣以五路并发补全资料，TMDB 直接展示日榜或周榜；切换或刷新时取消旧请求。 */
export function useHotMovies(kind: HotKind, source: HotSource = 'douban', timeWindow: TrendingWindow = 'day') {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<Result>();
    useEffect(() => {
        const controller = new AbortController();
        const {signal} = controller;

        async function load() {
            if (source === 'tmdb') {
                // 字典与榜单并行获取，分别处理失败；电影榜不额外请求电视剧使用的地区字典。
                const genresRequest = getGenres(kind).then(
                    genres => ({genres, genreError: undefined}),
                    error => ({genres: [], genreError: requestErrorMessage(error)}),
                );
                const countriesRequest = kind === 'tv' ? getCountries().then(
                    countries => ({countries, countryError: undefined}),
                    error => ({countries: [], countryError: requestErrorMessage(error)}),
                ) : Promise.resolve({countries: [], countryError: undefined});
                try {
                    const movies = await (kind === 'movie' ? getTrendingMovies : getTrendingTVShows)(timeWindow, signal);
                    if (!Array.isArray(movies)) throw new Error('榜单格式错误');
                    if (signal.aborted) return;
                    const rows = toTrendingRows(movies);
                    setResult({
                        source, kind, timeWindow, attempt, rows, feed: {
                            items: rows.map(row => row.item), fetchedAt: new Date().toISOString(),
                        }
                    });
                    const updateMetadata = (metadata: Pick<Result, 'genres' | 'genreError' | 'countries' | 'countryError'>) => {
                        if (!signal.aborted) setResult(previous => previous?.source === source &&
                        previous.kind === kind && previous.timeWindow === timeWindow && previous.attempt === attempt
                            ? {...previous, ...metadata} : previous);
                    };
                    // 字典完成后各自更新，不让较慢的接口阻塞另一个字典的展示。
                    await Promise.all([genresRequest.then(updateMetadata), countriesRequest.then(updateMetadata)]);
                } catch (error) {
                    if (!signal.aborted) setResult({
                        source, kind, timeWindow, attempt, rows: [],
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
                    source,
                    kind,
                    timeWindow,
                    attempt,
                    rows: [],
                    error: '豆瓣榜单暂时无法加载，请稍后重试。'
                });
                return;
            }
            if (signal.aborted) return;
            setResult({
                source,
                kind,
                timeWindow,
                attempt,
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
                    setResult(previous => previous?.source === source && previous.kind === kind && previous.timeWindow === timeWindow && previous.attempt === attempt ? {
                        ...previous, rows: previous.rows.map((value, position) => position === index ? row : value),
                    } : previous);
                }
            }

            await Promise.all(Array.from({length: Math.min(5, feed.items.length)}, worker));
        }

        void load();
        return () => controller.abort();
    }, [attempt, kind, source, timeWindow]);
    // 切换选项后不展示上一组结果；榜单已返回但仍在补全资料时，用 matching 单独提示进度。
    const current = result?.source === source && result.kind === kind && result.timeWindow === timeWindow && result.attempt === attempt ? result : undefined;
    return {
        rows: current?.rows ?? [],
        genres: current?.genres ?? [],
        genreError: current?.genreError,
        countries: current?.countries ?? [],
        countryError: current?.countryError,
        fetchedAt: current?.feed?.fetchedAt,
        error: current?.error,
        loading: !current,
        matching: current?.rows.some(row => row.status === 'loading') ?? false,
        refresh: () => setAttempt(value => value + 1),
    };
}
