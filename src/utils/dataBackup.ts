/**
 * 备份格式的解析、校验和清洗，不依赖浏览器界面，便于独立测试。
 * 导入内容视为不可信数据：逐字段检查，并只复制允许持久化的字段。
 */
import type {BackupPayload, EpisodeRecord, ProgressData, ProgressRecord, WatchStatus} from '../types/index.ts';

// JSON 中的数组和 null 不能当作对象继续读取字段。
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
    return value as Record<string, unknown>;
}

function text(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Invalid text');
    return value;
}

// ID、季号和集数要求安全整数；时间戳和评分也必须为有限的非负数。
function number(value: unknown, integer = false): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) {
        throw new Error('Invalid number');
    }
    return value;
}

// 使用字段白名单重新构造数据，防止旧版账号凭据或已移除的集成配置进入新备份。
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
        // 空海报路径兼容旧备份的 null；其余可选字段仅在提供时写入。
        const common = {
            tmdb_id: id,
            rating,
            global_comment: text(record.global_comment),
            ...(status === undefined ? {} : {global_status: status as WatchStatus}),
            ...(record.name === undefined ? {} : {name: text(record.name)}),
            ...(record.poster_path == null ? {} : {poster_path: text(record.poster_path)}),
            ...(record.last_interacted === undefined ? {} : {last_interacted: number(record.last_interacted)}),
        };
        // 同时核对记录键和内容中的 ID，避免导入后出现查不到或误覆盖的记录。
        if (record.type === 'movie') {
            if (key !== `tmdb_movie_${id}`) throw new Error('Invalid movie key');
            records[key] = {...common, type: 'movie'};
        } else if (record.type === 'tv_season') {
            const season = number(record.season_number, true);
            if (key !== `tmdb_tv_${id}_s${season}`) throw new Error('Invalid season key');
            const episodes: Record<string, EpisodeRecord> = {};
            // 集号必须是数字字符串，每一集的观看状态和历史备注分别校验。
            for (const [episodeKey, value] of Object.entries(object(record.episodes))) {
                const episode = object(value);
                if (!/^\d+$/.test(episodeKey) || !Number.isSafeInteger(Number(episodeKey)) || typeof episode.watched !== 'boolean') {
                    throw new Error('Invalid episode');
                }
                episodes[episodeKey] = {watched: episode.watched, comment: text(episode.comment)};
            }
            records[key] = {
                ...common,
                type: 'tv_season',
                season_number: season,
                episodes,
                ...(record.show_name === undefined ? {} : {show_name: text(record.show_name)}),
                ...(record.episode_count === undefined ? {} : {episode_count: number(record.episode_count, true)}),
            };
        } else {
            throw new Error('Invalid record type');
        }
    }
    return {user_id: text(data.user_id), last_sync: number(data.last_sync), records};
}

/** 支持旧版原始记录对象，以及带 metadata 的第 2 至第 4 版备份；校验失败则抛错。 */
export function parseBackup(json: string): ProgressData {
    const parsed = object(JSON.parse(json));
    // 新版读取带版本信息的外层，旧版直接读取记录；两条路径最终使用同一字段白名单。
    if ('progressData' in parsed) {
        const version = number(object(parsed.metadata).version, true);
        if (version < 2 || version > 4) throw new Error('Unsupported backup version');
        return cleanProgress(parsed.progressData);
    }
    return cleanProgress(parsed);
}

/** 导出也执行相同清洗规则，确保新备份不携带未知字段，且不修改传入的原数据。 */
export function createBackup(data: ProgressData): BackupPayload {
    return {
        metadata: {version: 4, exported_at: new Date().toISOString()},
        progressData: cleanProgress(data),
    };
}
