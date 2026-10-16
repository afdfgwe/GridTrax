import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {
    EpisodeRecord,
    MovieRecord,
    ProgressData,
    ProgressRecord,
    SeasonRecord,
    WatchStatus,
} from '../types';

interface ProgressState {
    data: ProgressData;
    fillMissingPosters: (type: ProgressRecord['type'], tmdbId: number, posterPath?: string) => void;
    // TV Season actions
    ensureSeasonRecord: (tvId: number, seasonNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    toggleEpisodeWatched: (tvId: number, seasonNumber: number, episodeNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    watchUpToEpisode: (tvId: number, seasonNumber: number, episodeNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    setSeasonStatus: (tvId: number, seasonNumber: number, status: WatchStatus, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    // Movie actions
    ensureMovieRecord: (movieId: number, meta?: { name?: string; poster_path?: string }) => void;
    setMovieStatus: (movieId: number, status: WatchStatus, meta?: { name?: string; poster_path?: string }) => void;
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

const defaultEpisodeRecord = (): EpisodeRecord => ({watched: false, comment: ''});

export const useProgressStore = create<ProgressState>()(
    persist(
        (set, get) => ({
            data: {
                user_id: 'local_user',
                last_sync: Date.now(),
                records: {},
            },

            fillMissingPosters: (type, tmdbId, posterPath) => {
                if (!posterPath) return;
                set((state) => {
                    const entries = Object.entries(state.data.records).filter(([, record]) =>
                        record.type === type && record.tmdb_id === tmdbId && !record.poster_path
                    );
                    if (entries.length === 0) return state;
                    const records = {...state.data.records};
                    for (const [key, record] of entries) {
                        records[key] = {...record, poster_path: posterPath};
                    }
                    return {data: {...state.data, records}};
                });
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
                                        [key]: {...rec, ...meta}
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
                                        [epKey]: {...current, watched: !current.watched},
                                    },
                                },
                            },
                        },
                    };
                });
            },

            watchUpToEpisode: (tvId, seasonNumber, episodeNumber, meta) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber, meta);
                set((state) => {
                    const record = state.data.records[key] as SeasonRecord;
                    const updatedEpisodes = {...record.episodes};
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
                                [key]: {...record, last_interacted: Date.now(), episodes: updatedEpisodes},
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
                                        [key]: {...rec, ...meta}
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
                            [key]: {
                                ...(state.data.records[key] as MovieRecord),
                                global_status: status,
                                last_interacted: Date.now()
                            },
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
                    const newRecords = {...state.data.records};
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
