import {useEffect, useState, useSyncExternalStore} from 'react';
import {getMovie, getTVShow} from '../api/tmdb';
import {useProgressStore} from '../store/useProgressStore';
import {mediaMetadataCache} from '../utils/mediaMetadataCache';
import {createHomeMediaDetailsLoader} from '../utils/homeMediaDetailsLoader';
import type {ProgressRecord} from '../types';

/** 先恢复独立资料缓存，再按视口优先级后台补齐；不修改观看状态和最近互动时间。 */
export function useHomeMediaDetails(records: ProgressRecord[], getPriorityKeys: () => string[]) {
    const fillMissingPosters = useProgressStore((state) => state.fillMissingPosters);
    const [loader] = useState(() => createHomeMediaDetailsLoader(records, {
        cache: mediaMetadataCache,
        load: record => record.type === 'movie' ? getMovie(record.tmdb_id) : getTVShow(record.tmdb_id),
        fillPoster: (record, posterPath) => fillMissingPosters(record.type, record.tmdb_id, posterPath),
    }));
    const snapshot = useSyncExternalStore(loader.subscribe, loader.getSnapshot);

    // 记录集合或视口优先级来源变化时刷新队列；已缓存资料直接复用，仅补齐缺失或过期的条目。
    useEffect(() => {
        loader.update(records, getPriorityKeys);
    }, [loader, records, getPriorityKeys]);

    useEffect(() => {
        loader.start();
        const flush = () => mediaMetadataCache.flush();
        window.addEventListener('pagehide', flush);
        // 不取消 API 层共享请求；卸载后只写资料缓存，不再更新本页或用户记录。
        return () => {
            window.removeEventListener('pagehide', flush);
            loader.stop();
        };
    }, [loader]);

    return {...snapshot, retry: loader.retry};
}
