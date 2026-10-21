import type {TMDBSeasonSummary} from '../types';

/** 常规季名统一格式，自定义季名同时保留季号，便于识别系列顺序。 */
export function getSeasonTitle(season: TMDBSeasonSummary): string {
    const name = season.name?.trim() || '';
    const label = `第 ${season.season_number} 季`;
    // 只把纯季号名称视为默认名，带剧情含义的自定义季名不能被替换掉。
    const isDefaultName = /^第\s*[\d零〇一二三四五六七八九十百两]+\s*季$/.test(name)
        || /^season\s*\d+$/i.test(name);
    return !name || isDefaultName ? label : `${label} · ${name}`;
}

/** 单季作品忽略换行、空格差异后去重；多季作品保留各季独立简介。 */
export function getSeasonOverview(overview: string, showOverview: string, isOnlySeason: boolean): string {
    const text = overview?.trim() || '';
    const normalize = (value: string) => value.replace(/\s+/g, '');
    return isOnlySeason && normalize(text) === normalize(showOverview) ? '' : text;
}
