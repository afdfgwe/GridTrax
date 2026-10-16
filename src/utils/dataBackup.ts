import type { BackupPayload, EpisodeRecord, ProgressData, ProgressRecord, WatchStatus } from '../types/index.ts';

function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
    return value as Record<string, unknown>;
}

function text(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Invalid text');
    return value;
}

function number(value: unknown, integer = false): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) {
        throw new Error('Invalid number');
    }
    return value;
}

// Whitelist persisted fields so legacy account credentials never enter new backups.
function cleanProgress(value: unknown): ProgressData {
    const data = object(value);
    const records: Record<string, ProgressRecord> = {};
    for (const [key, value] of Object.entries(object(data.records))) {
        const record = object(value);
        const id = number(record.tmdb_id, true);
        if (id === 0) throw new Error('Invalid TMDB ID');
        const rating = number(record.rating);
        if (rating > 10) throw new Error('Invalid rating');
        const status = record.global_status;
        if (status !== undefined && !['Wish', 'Do', 'Collect', 'OnHold', 'Dropped'].includes(text(status))) {
            throw new Error('Invalid watch status');
        }
        const common = {
            tmdb_id: id,
            rating,
            global_comment: text(record.global_comment),
            ...(status === undefined ? {} : { global_status: status as WatchStatus }),
            ...(record.name === undefined ? {} : { name: text(record.name) }),
            ...(record.poster_path == null ? {} : { poster_path: text(record.poster_path) }),
            ...(record.last_interacted === undefined ? {} : { last_interacted: number(record.last_interacted) }),
        };
        if (record.type === 'movie') {
            if (key !== `tmdb_movie_${id}`) throw new Error('Invalid movie key');
            records[key] = { ...common, type: 'movie' };
        } else if (record.type === 'tv_season') {
            const season = number(record.season_number, true);
            if (key !== `tmdb_tv_${id}_s${season}`) throw new Error('Invalid season key');
            const episodes: Record<string, EpisodeRecord> = {};
            for (const [episodeKey, value] of Object.entries(object(record.episodes))) {
                const episode = object(value);
                if (!/^\d+$/.test(episodeKey) || !Number.isSafeInteger(Number(episodeKey)) || typeof episode.watched !== 'boolean') {
                    throw new Error('Invalid episode');
                }
                episodes[episodeKey] = { watched: episode.watched, comment: text(episode.comment) };
            }
            records[key] = {
                ...common,
                type: 'tv_season',
                season_number: season,
                episodes,
                ...(record.show_name === undefined ? {} : { show_name: text(record.show_name) }),
                ...(record.episode_count === undefined ? {} : { episode_count: number(record.episode_count, true) }),
            };
        } else {
            throw new Error('Invalid record type');
        }
    }
    return { user_id: text(data.user_id), last_sync: number(data.last_sync), records };
}

export function parseBackup(json: string): ProgressData {
    const parsed = object(JSON.parse(json));
    if ('progressData' in parsed) {
        const version = number(object(parsed.metadata).version, true);
        if (version < 2 || version > 4) throw new Error('Unsupported backup version');
        return cleanProgress(parsed.progressData);
    }
    return cleanProgress(parsed);
}

export function createBackup(data: ProgressData): BackupPayload {
    return {
        metadata: { version: 4, exported_at: new Date().toISOString() },
        progressData: cleanProgress(data),
    };
}
