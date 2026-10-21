import assert from 'node:assert/strict';
import test from 'node:test';
import {groupWatchedTimeline} from '../src/utils/watchedTimeline.ts';

const movie = (id, last_interacted, extra = {}) => ({
    type: 'movie', tmdb_id: id, name: `影片 ${id}`, global_status: 'Collect',
    rating: 0, global_comment: '', last_interacted, ...extra,
});
// 用本地日历构造时间，与分组函数保持同一时区语义，避免测试受运行机器时区影响。
const timestamp = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const flatten = months => months.flatMap(month => month.days.flatMap(day => day.entries));

// 同日多条记录、跨月和跨年都按毫秒时间排序，不能按中文标签或月份字符串排序。
test('按最近操作倒序分月、分日，并且不修改原始记录', () => {
    const records = [movie(1, timestamp(2025, 12, 31)), movie(2, timestamp(2026, 10, 18, 9)),
        movie(3, timestamp(2026, 2, 1)), movie(4, timestamp(2026, 10, 18, 20)), movie(5, timestamp(2026, 10, 17))];
    const before = structuredClone(records);
    const months = groupWatchedTimeline(records);
    assert.deepEqual(months.map(month => month.label), ['2026年10月', '2026年2月', '2025年12月']);
    assert.deepEqual(months.map(month => month.count), [3, 1, 1]);
    assert.deepEqual(months[0].days.map(day => day.day), ['18', '17']);
    assert.deepEqual(flatten(months).map(entry => entry.record.tmdb_id), [4, 2, 5, 3, 1]);
    assert.deepEqual(records, before);
});

test('缺失或无效时间统一放在末尾，不伪造时间', () => {
    const invalid = [undefined, 0, -1, NaN, Infinity, 9e20, '2026-10-18'];
    const months = groupWatchedTimeline([...invalid.map((time, index) => movie(index, time)), movie(99, timestamp(2026, 10, 18))]);
    assert.equal(months.length, 2);
    assert.equal(months[1].label, '时间未知');
    assert.equal(months[1].count, invalid.length);
    assert.ok(months[1].days[0].entries.every(entry => entry.timestamp === null));
    assert.equal(flatten(months)[0].record.tmdb_id, 99);
});

test('同剧不同季分别保留，仅显示看过记录，超过十五条也不截断', () => {
    const records = Array.from({length: 20}, (_, index) => movie(index, timestamp(2026, 10, 18)));
    for (const season_number of [1, 2]) records.push({
        ...movie(100, timestamp(2026, 10, 17)), type: 'tv_season', season_number, episodes: {},
    });
    records.push(movie(999, timestamp(2026, 10, 19), {global_status: 'Wish'}));
    const entries = flatten(groupWatchedTimeline(records));
    assert.equal(entries.length, 22);
    assert.deepEqual(entries.filter(entry => entry.record.type === 'tv_season').map(entry => entry.record.season_number), [1, 2]);
});

test('按本地日历分组，午夜前后属于不同日期', () => {
    const months = groupWatchedTimeline([movie(1, timestamp(2026, 10, 17, 23, 59)), movie(2, timestamp(2026, 10, 18, 0, 1))]);
    assert.deepEqual(months[0].days.map(day => day.key), ['2026-10-18', '2026-10-17']);
});

test('再次操作后移动到新日期，记录仍只出现一次', () => {
    const records = [movie(1, timestamp(2026, 1, 1)), movie(2, timestamp(2026, 10, 17))];
    records[0] = {...records[0], last_interacted: timestamp(2026, 10, 18)};
    const months = groupWatchedTimeline(records);
    assert.deepEqual(flatten(months).map(entry => entry.record.tmdb_id), [1, 2]);
    assert.equal(months.length, 1);
    assert.deepEqual(groupWatchedTimeline([]), []);
});
