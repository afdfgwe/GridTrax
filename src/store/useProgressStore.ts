/**
 * 集中管理观影记录的日常读写，使用 Zustand 管理内存状态并持久化到 localStorage。
 * 电视剧以“剧 ID + 季号”为单位，电影以电影 ID 为单位；页面应通过动作更新记录。
 * JSON 导入是整体替换的特例，由备份面板校验并确认后直接恢复状态快照。
 */
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
    // 电视剧季动作：确保记录存在、切换单集、批量标记和修改整季状态。
    ensureSeasonRecord: (tvId: number, seasonNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    toggleEpisodeWatched: (tvId: number, seasonNumber: number, episodeNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    watchUpToEpisode: (tvId: number, seasonNumber: number, episodeNumber: number, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    setSeasonStatus: (tvId: number, seasonNumber: number, status: WatchStatus, meta?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number }) => void;
    // 电影动作：不需要单集明细，只维护整部电影的元信息和观看状态。
    ensureMovieRecord: (movieId: number, meta?: { name?: string; poster_path?: string }) => void;
    setMovieStatus: (movieId: number, status: WatchStatus, meta?: { name?: string; poster_path?: string }) => void;
    // 只读查询：不会因为渲染页面而创建新记录。
    getSeasonRecord: (tvId: number, seasonNumber: number) => SeasonRecord | undefined;
    getMovieRecord: (movieId: number) => MovieRecord | undefined;
    getEpisodeRecord: (tvId: number, seasonNumber: number, episodeNumber: number) => EpisodeRecord;
    // 删除指定电影或指定季的整条记录。
    removeRecord: (recordKey: string) => void;
}

// 记录键同时用于本地存储和备份校验，必须与 dataBackup 中的校验规则保持一致。
const seasonKey = (tvId: number, seasonNumber: number) => `tmdb_tv_${tvId}_s${seasonNumber}`;
const movieKey = (movieId: number) => `tmdb_movie_${movieId}`;

// 新记录默认没有观看状态；历史评分和吐槽字段仍保留，避免旧备份丢失数据。
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

            // 详情接口返回海报后，仅补齐同类型、同作品的空海报，不覆盖已有季海报。
            // 这属于元信息补全，因此不更新最近互动时间，也不会改变观看状态。
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

            // 先保证目标季存在；只浏览季详情时不应主动调用，避免创建无意义的记录。
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
                    // 已有记录缺少名称或海报时，合并调用方传入的元信息。
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

            // 单击集数只切换该集的 watched；保留其他集数以及历史备注字段。
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

            // “看到这里”按真实集号处理，不受页面正序、倒序或分页方式影响。
            watchUpToEpisode: (tvId, seasonNumber, episodeNumber, meta) => {
                const key = seasonKey(tvId, seasonNumber);
                get().ensureSeasonRecord(tvId, seasonNumber, meta);
                set((state) => {
                    const record = state.data.records[key] as SeasonRecord;
                    const updatedEpisodes = {...record.episodes};
                    // 从第 1 集到目标集（含目标集）全部标为已看，后续集数保持原样。
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

            // 整季状态与单集进度分开保存：选“看过”不会在这里批量改写所有集数。
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
                                // 用户明确修改状态时同步保存元信息，未提供的字段沿用旧值。
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

            // 电影详情页也会调用此动作补全资料，但没有状态的记录不进入追踪列表。
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

            // 状态操作刷新最近互动时间，首页“最近互动”排序直接读取该字段。
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

            // 未保存的集数按“未看”返回默认值，不向存储中写入占位记录。
            getEpisodeRecord: (tvId, seasonNumber, episodeNumber) => {
                const key = seasonKey(tvId, seasonNumber);
                const record = get().data.records[key] as SeasonRecord | undefined;
                return record?.episodes[String(episodeNumber)] ?? defaultEpisodeRecord();
            },

            // 删除前复制记录表，保持不可变更新，让订阅该状态的组件正常重渲染。
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
            // 备份导入面板也使用该键，修改时必须同步调整导入写入位置。
            name: 'gridtrax-progress',
        }
    )
);
