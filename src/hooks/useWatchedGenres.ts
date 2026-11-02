import {useEffect, useState, useSyncExternalStore} from 'react';
import {getMovie, getTVShow} from '../api/tmdb';
import type {ProgressRecord} from '../types';
import {mediaMetadataCache} from '../utils/mediaMetadataCache';
import {createWatchedGenresLoader} from '../utils/watchedGenresLoader';

/** 观看统计复用首页的小字段缓存；类型、地区与年份共用详情，离开页面后停止队列。 */
export function useWatchedGenres(records: ProgressRecord[]) {
    const [loader] = useState(() => createWatchedGenresLoader(records, {
        cache: mediaMetadataCache,
        load: record => record.type === 'movie' ? getMovie(record.tmdb_id) : getTVShow(record.tmdb_id),
    }));
    const snapshot = useSyncExternalStore(loader.subscribe, loader.getSnapshot);
    useEffect(() => loader.update(records), [loader, records]);
    useEffect(() => {
        loader.start();
        const flush = () => mediaMetadataCache.flush();
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            loader.stop();
        };
    }, [loader]);
    return {...snapshot, retry: loader.retry};
}
