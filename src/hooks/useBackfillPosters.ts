import { useEffect, useRef } from 'react';
import { getMovie, getTVShow } from '../api/tmdb';
import { useProgressStore } from '../store/useProgressStore';
import type { ProgressRecord } from '../types';

export function useBackfillPosters(records: ProgressRecord[]) {
    const requests = useRef(new Map<string, Promise<string | undefined>>());
    const fillMissingPosters = useProgressStore((state) => state.fillMissingPosters);

    useEffect(() => {
        let cancelled = false;

        const backfill = async () => {
            // Sequential requests avoid flooding TMDB after a large import.
            for (const record of records) {
                if (cancelled) return;
                if (record.poster_path) continue;
                const key = `${record.type}-${record.tmdb_id}`;
                let request = requests.current.get(key);
                if (!request) {
                    request = (record.type === 'movie'
                        ? getMovie(record.tmdb_id)
                        : getTVShow(record.tmdb_id))
                        .then((detail) => detail.poster_path)
                        .catch(() => undefined);
                    // Cache pending and empty results across rerenders and TV seasons.
                    requests.current.set(key, request);
                }
                const posterPath = await request;
                if (cancelled) return;
                fillMissingPosters(record.type, record.tmdb_id, posterPath);
            }
        };

        void backfill();
        return () => { cancelled = true; };
    }, [records, fillMissingPosters]);
}
