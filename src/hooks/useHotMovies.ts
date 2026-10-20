import {useEffect, useState} from 'react';
import {getTrendingMovies, searchMovies, searchTV} from '../api/tmdb';
import type {HotRow, HotFeed, HotKind, HotSource} from '../types/hotMovies';
import {resolveHotMovie} from '../utils/hotMovieMatch';
import {requestErrorMessage} from '../utils/requestError';
import {toTrendingRows} from '../utils/trendingMovies';

interface Result {
    source: HotSource;
    kind: HotKind;
    attempt: number;
    feed?: HotFeed;
    rows: HotRow[];
    error?: string;
}

/** 豆瓣以五路并发补全资料，TMDB 直接展示日榜；切换或刷新时取消旧请求。 */
export function useHotMovies(kind: HotKind, source: HotSource = 'douban') {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<Result>();
    useEffect(() => {
        const controller = new AbortController();
        const {signal} = controller;

        async function load() {
            if (source === 'tmdb') {
                try {
                    const movies = await getTrendingMovies(signal);
                    if (!Array.isArray(movies)) throw new Error('榜单格式错误');
                    if (signal.aborted) return;
                    const rows = toTrendingRows(movies);
                    setResult({source, kind, attempt, rows, feed: {
                        items: rows.map(row => row.item), fetchedAt: new Date().toISOString(),
                    }});
                } catch (error) {
                    if (!signal.aborted) setResult({source, kind, attempt, rows: [],
                        error: `TMDB 榜单暂时无法加载。${requestErrorMessage(error)}`});
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
                if (!signal.aborted) setResult({source, kind, attempt, rows: [], error: '豆瓣榜单暂时无法加载，请稍后重试。'});
                return;
            }
            if (signal.aborted) return;
            setResult({source, kind, attempt, feed, rows: feed.items.map(item => ({item, status: 'loading'}))});
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
                    setResult(previous => previous?.source === source && previous.kind === kind && previous.attempt === attempt ? {
                        ...previous, rows: previous.rows.map((value, position) => position === index ? row : value),
                    } : previous);
                }
            }

            await Promise.all(Array.from({length: Math.min(5, feed.items.length)}, worker));
        }

        void load();
        return () => controller.abort();
    }, [attempt, kind, source]);
    const current = result?.source === source && result.kind === kind && result.attempt === attempt ? result : undefined;
    return {
        rows: current?.rows ?? [],
        fetchedAt: current?.feed?.fetchedAt,
        error: current?.error,
        loading: !current,
        matching: current?.rows.some(row => row.status === 'loading') ?? false,
        refresh: () => setAttempt(value => value + 1),
    };
}
