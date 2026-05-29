import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GRIDTRAX_TO_BANGUMI } from '../api/bangumiService';
import { autoLinkAndPushToBangumi, autoPushEpisodeToBangumi, autoPushToBangumi } from '../components/BangumiSyncPanel';
import type {
    EpisodeRecord,
    MovieRecord,
    ProgressData,
    SeasonRecord,
    WatchStatus,
} from '../types';
import { useBangumiStore } from './useBangumiStore';

interface ProgressState {
    data: ProgressData;
    // TV Season actions
    // TV Season actions
    ensureSeasonRecord: (tvId: number, seasonNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    toggleEpisodeWatched: (tvId: number, seasonNumber: number, episodeNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    watchUpToEpisode: (tvId: number, seasonNumber: number, episodeNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    setEpisodeComment: (tvId: number, seasonNumber: number, episodeNumber: number, comment: string) => void;
    setSeasonStatus: (tvId: number, seasonNumber: number, status: WatchStatus, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    setSeasonRating: (tvId: number, seasonNumber: number, rating: number) => void;
    setSeasonComment: (tvId: number, seasonNumber: number, comment: string) => void;
    // Movie actions
    ensureMovieRecord: (movieId: number, meta?: { name?: string; poster_path?: string }) => void;
    setMovieStatus: (movieId: number, status: WatchStatus, meta?: { name?: string; poster_path?: string }) => void;
    setMovieRating: (movieId: number, rating: number) => void;
    setMovieComment: (movieId: number, comment: string) => void;
    // Getters
    getSeasonRecord: (tvId: number, seasonNumber: number) => SeasonRecord | undefined;
    getMovieRecord: (movieId: number) => MovieRecord | undefined;
    getEpisodeRecord: (tvId: number, seasonNumber: number, episodeNumber: number) => EpisodeRecord;
    // Settings
    removeRecord: (recordKey: string) => void;
}

const seasonKey = (tvId: number, seasonNumber: number) => `tmdb_tv_${tvId}_s${seasonNumber}`;
const movieKey = (movieId: number) => `tmdb_movie_${movieId}`;

const defaultSeasonRecord = (tvId: number, seasonNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }): SeasonRecord => ({
    type: 'tv_season',
    tmdb_id: tvId,
    season_number: seasonNumber,
    name: meta?.name,
    show_name: meta?.show_name,
    poster_path: meta?.poster_path,
    episode_count: meta?.episode_count,
    global_status: undefined,
    rating: 0,
    global_comment: '',
    episodes: {},
});

const defaultMovieRecord = (movieId: number, meta?: { name?: string; poster_path?: string }): MovieRecord => ({
    type: 'movie',
    tmdb_id: movieId,
    name: meta?.name,
    poster_path: meta?.poster_path,
    global_status: undefined,
    rating: 0,
    global_comment: '',
});

const defaultEpisodeRecord = (): EpisodeRecord => ({ watched: false, comment: '' });

export const useProgressStore = create<ProgressState>()(
    persist(
        (set, get) => ({
            data: {
                user_id: 'local_user',
                last_sync: Date.now(),
                records: {},
            },

            ensureSeasonRecord: (tvId, seasonNumber, meta) => {
                const key = seasonKey(tvId, seasonNumber);
                if (!get().data.records[key]) {
                    set((state) => ({
                        data: {
                            ...state.data,
                            records: {
                                ...state.data.records,
                                [key]: defaultSeasonRecord(tvId, seasonNumber, meta),
                            },
                        },
                    }));
                } else if (meta) {
                    // Update meta if provided and missing
                    set((state) => {
                        const rec = state.data.records[key] as SeasonRecord;
                        if (!rec.name || !rec.poster_path || !rec.show_name) {
                            return {
                                data: {
                                    ...state.data,
                                    records: {
                                        ...state.data.records,
                                        [key]: { ...rec, ...meta }
                                    }
                                }
                            };
                        }
                        return state;
                    });
                }
            },

            toggleEpisodeWatched: (tvId, seasonNumber, episodeNumber, meta) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber, meta);
                set((state) => {
                    const record = state.data.records[key] as SeasonRecord;
                    const epKey = String(episodeNumber);
                    const current = record.episodes[epKey] ?? defaultEpisodeRecord();
                    return {
                        data: {
                            ...state.data,
                            last_sync: Date.now(),
                            records: {
                                ...state.data.records,
                                [key]: {
                                    ...record,
                                    last_interacted: Date.now(),
                                    episodes: {
                                        ...record.episodes,
                                        [epKey]: { ...current, watched: !current.watched },
                                    },
                                },
                            },
                        },
                    };
                });
                // Determine new state after toggle and push to Bangumi
                // Note: get() here returns the already-toggled state, so use it directly
                const afterToggle = (get().data.records[key] as SeasonRecord | undefined)
                    ?.episodes?.[String(episodeNumber)]?.watched ?? false;
                if (useBangumiStore.getState().autoSyncEnabled) {
                    void autoPushEpisodeToBangumi(tvId, seasonNumber, episodeNumber, afterToggle);
                }
            },

            watchUpToEpisode: (tvId, seasonNumber, episodeNumber, meta) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber, meta);
                set((state) => {
                    const record = state.data.records[key] as SeasonRecord;
                    const updatedEpisodes = { ...record.episodes };
                    // Mark all episodes from 1 to episodeNumber (inclusive) as watched
                    for (let i = 1; i <= episodeNumber; i++) {
                        const epKey = String(i);
                        updatedEpisodes[epKey] = {
                            ...(updatedEpisodes[epKey] ?? defaultEpisodeRecord()),
                            watched: true,
                        };
                    }
                    return {
                        data: {
                            ...state.data,
                            last_sync: Date.now(),
                            records: {
                                ...state.data.records,
                                [key]: { ...record, last_interacted: Date.now(), episodes: updatedEpisodes },
                            },
                        },
                    };
                });
                // Push all newly-watched episodes to Bangumi in the background
                if (useBangumiStore.getState().autoSyncEnabled) {
                    for (let i = 1; i <= episodeNumber; i++) {
                        void autoPushEpisodeToBangumi(tvId, seasonNumber, i, true);
                    }
                }
            },

            setEpisodeComment: (tvId, seasonNumber, episodeNumber, comment) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber);
                set((state) => {
                    const record = state.data.records[key] as SeasonRecord;
                    const epKey = String(episodeNumber);
                    const current = record.episodes[epKey] ?? defaultEpisodeRecord();
                    return {
                        data: {
                            ...state.data,
                            records: {
                                ...state.data.records,
                                [key]: {
                                    ...record,
                                    episodes: { ...record.episodes, [epKey]: { ...current, comment } },
                                },
                            },
                        },
                    };
                });
            },

            setSeasonStatus: (tvId, seasonNumber, status, meta) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber, meta);
                set((state) => ({
                    data: {
                        ...state.data,
                        records: {
                            ...state.data.records,
                            [key]: {
                                ...(state.data.records[key] as SeasonRecord),
                                global_status: status,
                                last_interacted: Date.now(),
                                // Always persist meta when explicitly setting status
                                ...(meta ? {
                                    name: meta.name ?? (state.data.records[key] as SeasonRecord)?.name,
                                    show_name: meta.show_name ?? (state.data.records[key] as SeasonRecord)?.show_name,
                                    poster_path: meta.poster_path ?? (state.data.records[key] as SeasonRecord)?.poster_path,
                                    episode_count: meta.episode_count ?? (state.data.records[key] as SeasonRecord)?.episode_count,
                                } : {}),
                            },
                        },
                    },
                }));
                // Auto-push/auto-link to Bangumi (best-effort, async)
                if (useBangumiStore.getState().autoSyncEnabled) {
                    const rec = get().data.records[key] as SeasonRecord | undefined;
                    if (rec?.bangumi_subject_id) {
                        // Already linked → just push the updated status
                        autoPushToBangumi(
                            rec.bangumi_subject_id,
                            GRIDTRAX_TO_BANGUMI[status],
                            rec.rating ?? 0,
                        );
                    } else if (!rec?.bangumi_scanned) {
                        // Not yet linked and not yet searched → try to find a match on Bangumi
                        const showName = rec?.show_name || rec?.name;
                        void autoLinkAndPushToBangumi(tvId, seasonNumber, showName, status, rec?.rating ?? 0);
                    }
                }
            },

            setSeasonRating: (tvId, seasonNumber, rating) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber);
                set((state) => ({
                    data: {
                        ...state.data,
                        records: {
                            ...state.data.records,
                            [key]: { ...(state.data.records[key] as SeasonRecord), rating, last_interacted: Date.now() },
                        },
                    },
                }));
                // Auto-push to Bangumi (best-effort)
                if (useBangumiStore.getState().autoSyncEnabled) {
                    const rec = get().data.records[key] as SeasonRecord | undefined;
                    if (rec?.global_status) {
                        autoPushToBangumi(
                            rec.bangumi_subject_id,
                            GRIDTRAX_TO_BANGUMI[rec.global_status],
                            rating,
                        );
                    }
                }
            },

            setSeasonComment: (tvId, seasonNumber, comment) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber);
                set((state) => ({
                    data: {
                        ...state.data,
                        records: {
                            ...state.data.records,
                            [key]: { ...(state.data.records[key] as SeasonRecord), global_comment: comment },
                        },
                    },
                }));
            },

            ensureMovieRecord: (movieId, meta) => {
                const key = movieKey(movieId);
                if (!get().data.records[key]) {
                    set((state) => ({
                        data: {
                            ...state.data,
                            records: {
                                ...state.data.records,
                                [key]: defaultMovieRecord(movieId, meta),
                            },
                        },
                    }));
                } else if (meta) {
                    set((state) => {
                        const rec = state.data.records[key] as MovieRecord;
                        if (!rec.name || !rec.poster_path) {
                            return {
                                data: {
                                    ...state.data,
                                    records: {
                                        ...state.data.records,
                                        [key]: { ...rec, ...meta }
                                    }
                                }
                            };
                        }
                        return state;
                    });
                }
            },

            setMovieStatus: (movieId, status, meta) => {
                const key = movieKey(movieId);
                get().ensureMovieRecord(movieId, meta);
                set((state) => ({
                    data: {
                        ...state.data,
                        records: {
                            ...state.data.records,
                            [key]: { ...(state.data.records[key] as MovieRecord), global_status: status, last_interacted: Date.now() },
                        },
                    },
                }));
            },

            setMovieRating: (movieId, rating) => {
                const key = movieKey(movieId);
                get().ensureMovieRecord(movieId);
                set((state) => ({
                    data: {
                        ...state.data,
                        records: {
                            ...state.data.records,
                            [key]: { ...(state.data.records[key] as MovieRecord), rating, last_interacted: Date.now() },
                        },
                    },
                }));
            },

            setMovieComment: (movieId, comment) => {
                const key = movieKey(movieId);
                get().ensureMovieRecord(movieId);
                set((state) => ({
                    data: {
                        ...state.data,
                        records: {
                            ...state.data.records,
                            [key]: { ...(state.data.records[key] as MovieRecord), global_comment: comment },
                        },
                    },
                }));
            },

            getSeasonRecord: (tvId, seasonNumber) => {
                const key = seasonKey(tvId, seasonNumber);
                return get().data.records[key] as SeasonRecord | undefined;
            },

            getMovieRecord: (movieId) => {
                const key = movieKey(movieId);
                return get().data.records[key] as MovieRecord | undefined;
            },

            getEpisodeRecord: (tvId, seasonNumber, episodeNumber) => {
                const key = seasonKey(tvId, seasonNumber);
                const record = get().data.records[key] as SeasonRecord | undefined;
                return record?.episodes[String(episodeNumber)] ?? defaultEpisodeRecord();
            },

            removeRecord: (recordKey: string) => {
                set((state) => {
                    const newRecords = { ...state.data.records };
                    delete newRecords[recordKey];
                    return {
                        data: {
                            ...state.data,
                            last_sync: Date.now(),
                            records: newRecords,
                        },
                    };
                });
            },
        }),
        {
            name: 'gridtrax-progress',
        }
    )
);
