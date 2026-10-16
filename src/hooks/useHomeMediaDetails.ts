import {useEffect, useRef, useState} from 'react';
import {getMovie, getTVShow} from '../api/tmdb';
import {useProgressStore} from '../store/useProgressStore';
import type {ProgressRecord} from '../types';

type MediaDetails = { poster_path?: string; vote_average: number };

export function useHomeMediaDetails(records: ProgressRecord[]) {
    const requests = useRef(new Map<string, Promise<MediaDetails | undefined>>());
    const [scores, setScores] = useState<Record<string, number>>({});
    const fillMissingPosters = useProgressStore((state) => state.fillMissingPosters);

    useEffect(() => {
        let cancelled = false;
        const uniqueRecords = [...new Map(records.map((record) => [
            `${record.type}-${record.tmdb_id}`, record,
        ])).values()];

        const loadDetails = async () => {
            // Limit simultaneous requests when a large backup has been imported.
            for (let i = 0; i < uniqueRecords.length; i += 4) {
                if (cancelled) return;
                await Promise.all(uniqueRecords.slice(i, i + 4).map(async (record) => {
                    const key = `${record.type}-${record.tmdb_id}`;
                    let request = requests.current.get(key);
                    if (!request) {
                        request = (record.type === 'movie'
                            ? getMovie(record.tmdb_id)
                            : getTVShow(record.tmdb_id))
                            .catch(() => undefined);
                        requests.current.set(key, request);
                    }
                    const detail = await request;
                    if (cancelled || !detail) return;
                    if (Number.isFinite(detail.vote_average) && detail.vote_average > 0) {
                        setScores((current) => current[key] === detail.vote_average
                            ? current
                            : {...current, [key]: detail.vote_average});
                    }
                    fillMissingPosters(record.type, record.tmdb_id, detail.poster_path);
                }));
            }
        };

        void loadDetails();
        return () => {
            cancelled = true;
        };
    }, [records, fillMissingPosters]);

    return scores;
}
