import type {ProgressRecord} from '../types';

export interface TimelineEntry {
    record: ProgressRecord;
    timestamp: number | null;
}

interface TimelineDay {
    key: string;
    day: string;
    weekday: string;
    entries: TimelineEntry[];
}

export interface TimelineMonth {
    key: string;
    label: string;
    count: number;
    days: TimelineDay[];
}

/** 旧备份可能缺少时间；无效时间不推算成上映日期或导入日期。 */
const getTimestamp = (record: ProgressRecord): number | null => {
    const value = record.last_interacted;
    return typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime())
        ? value
        : null;
};

/** 每条看过记录只出现一次；按最近操作倒序，再按用户本地日历分月、分日。 */
export function groupWatchedTimeline(records: ProgressRecord[]): TimelineMonth[] {
    const entries = records.filter(record => record.global_status === 'Collect')
        .map(record => ({record, timestamp: getTimestamp(record)}))
        .sort((a, b) => (b.timestamp ?? -1) - (a.timestamp ?? -1));
    const months = new Map<string, TimelineMonth>();
    // 使用浏览器本地日期分组，同一次观看不会因转成 UTC 日期而被划到前一天或后一天。
    const weekdayFormat = new Intl.DateTimeFormat('zh-CN', {weekday: 'short'});

    for (const entry of entries) {
        const date = entry.timestamp === null ? null : new Date(entry.timestamp);
        const monthKey = date ? `${date.getFullYear()}-${date.getMonth() + 1}` : 'unknown';
        const dayKey = date ? `${monthKey}-${date.getDate()}` : 'unknown';
        let month = months.get(monthKey);
        if (!month) {
            month = {
                key: monthKey,
                label: date ? `${date.getFullYear()}年${date.getMonth() + 1}月` : '时间未知',
                count: 0,
                days: [],
            };
            months.set(monthKey, month);
        }
        // 已按时间排序，同一天的记录必然相邻，直接追加而不反复查找整个分组。
        let day = month.days.at(-1);
        if (!day || day.key !== dayKey) {
            day = {
                key: dayKey,
                day: date ? String(date.getDate()).padStart(2, '0') : '—',
                weekday: date ? weekdayFormat.format(date) : '无日期',
                entries: [],
            };
            month.days.push(day);
        }
        day.entries.push(entry);
        month.count += 1;
    }
    return [...months.values()];
}
