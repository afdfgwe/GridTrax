import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedRadarStats, MIN_RADAR_AXIS_COUNT} from '../src/utils/watchedRadar.ts';
import {toMediaMetadata} from '../src/utils/mediaMetadataCache.ts';

const movie = (id, global_status = 'Collect') => ({type: 'movie', tmdb_id: id, global_status});
const season = (id, number) => ({type: 'tv_season', tmdb_id: id, season_number: number, global_status: 'Collect'});
const detail = genres => toMediaMetadata({id: 1, genres});
const genre = id => ({id, name: `类型${id}`});

test('雷达图按观看量排序展示全部类型，保留完整分母，不修改输入', () => {
    const records = Array.from({length: 8}, (_, index) => movie(index + 1));
    const metadata = Object.fromEntries(records.map(record => [`movie-${record.tmdb_id}`,
        detail(Array.from({length: record.tmdb_id}, (_, index) => genre(index + 1)))]));
    const before = structuredClone({records, metadata});
    const stats = buildWatchedRadarStats(records, metadata, 'movie');
    assert.equal(stats.axes.length, 8);
    assert.deepEqual(stats.axes.map(axis => axis.count), [8, 7, 6, 5, 4, 3, 2, 1]);
    assert.deepEqual(stats.axes.map(axis => axis.key), ['1', '2', '3', '4', '5', '6', '7', '8']);
    assert.equal(stats.axes[0].share, 1);
    assert.equal(stats.axes[5].share, 3 / 8);
    assert.equal(stats.axes[7].share, 1 / 8);
    assert.equal(stats.genreCount, 8);
    assert.equal(stats.total, 8);
    assert.deepEqual({records, metadata}, before);
});

test('电影和电视剧独立统计，同剧多季按季计数、重复记录不重复累计', () => {
    const records = [movie(1), movie(1), movie(2, 'Wish'), season(1, 1), season(1, 2), season(1, 2)];
    const metadata = {'movie-1': detail([genre(1)]), 'tv_season-1': detail([genre(2), genre(2)])};
    const movies = buildWatchedRadarStats(records, metadata, 'movie');
    const series = buildWatchedRadarStats(records, metadata, 'tv_season');
    assert.equal(movies.total, 1);
    assert.equal(movies.axes[0].key, '1');
    assert.equal(movies.axes[0].count, 1);
    assert.equal(series.total, 2);
    assert.equal(series.axes[0].key, '2');
    assert.equal(series.axes[0].count, 2);
});

test('未标注类型保留独立轴，尚未加载的资料不计入任何类型，不足六轴补空轴', () => {
    const stats = buildWatchedRadarStats([movie(1), movie(2), movie(3)], {
        'movie-1': detail([genre(18)]), 'movie-2': detail([]),
    }, 'movie');
    assert.equal(stats.total, 3);
    assert.equal(stats.resolved, 2);
    assert.equal(stats.genreCount, 1);
    assert.equal(stats.unknownCount, 1);
    const known = stats.axes.find(axis => axis?.key === '18');
    const unknown = stats.axes.find(axis => axis?.key === 'unknown');
    assert.equal(known.share, 1 / 3);
    assert.equal(unknown.name, '未标注类型');
    assert.equal(unknown.count, 1);
    assert.equal(unknown.share, 1 / 3);
    assert.equal(stats.axes.filter(axis => axis === null).length, MIN_RADAR_AXIS_COUNT - 2);
});

test('空记录和全部未加载时不生成虚构维度', () => {
    for (const records of [[], [movie(1)]]) {
        const metadata = {};
        const stats = buildWatchedRadarStats(records, metadata, 'movie');
        assert.deepEqual(stats.axes, Array(MIN_RADAR_AXIS_COUNT).fill(null));
        assert.equal(stats.genreCount, 0);
        assert.equal(stats.unknownCount, 0);
        assert.equal(stats.maximum, 4);
    }
});

test('全部为未标注类型时仍展示雷达图，并且电影、电视剧计数隔离', () => {
    const records = [movie(1), season(1, 1), season(1, 2)];
    const metadata = {'movie-1': detail([]), 'tv_season-1': detail([])};
    for (const [kind, count] of [['movie', 1], ['tv_season', 2]]) {
        const stats = buildWatchedRadarStats(records, metadata, kind);
        assert.equal(stats.genreCount, 0);
        assert.equal(stats.unknownCount, count);
        assert.deepEqual(stats.axes[0], {key: 'unknown', name: '未标注类型', count, share: 1});
        assert.deepEqual(stats.axes.slice(1), Array(MIN_RADAR_AXIS_COUNT - 1).fill(null));
    }
});

test('电影和电视剧各自保留超过六种的全部类型，不把另一类别混入', () => {
    const metadata = {
        'movie-1': detail(Array.from({length: 19}, (_, index) => genre(index + 1))),
        'tv_season-1': detail(Array.from({length: 16}, (_, index) => genre(index + 101))),
    };
    const records = [movie(1), season(1, 1), season(1, 2)];
    const movies = buildWatchedRadarStats(records, metadata, 'movie');
    const series = buildWatchedRadarStats(records, metadata, 'tv_season');
    assert.equal(movies.axes.length, 19);
    assert.equal(series.axes.length, 16);
    assert.equal(movies.genreCount, 19);
    assert.equal(series.genreCount, 16);
    assert.ok(movies.axes.every(axis => axis.count === 1 && Number(axis.key) < 100));
    assert.ok(series.axes.every(axis => axis.count === 2 && Number(axis.key) > 100));
});

test('雷达刻度为整数且覆盖最大计数，英文电视剧类型沿用中文映射', () => {
    const records = Array.from({length: 13}, (_, index) => season(1, index + 1));
    const stats = buildWatchedRadarStats(records, {
        'tv_season-1': detail([{
            id: 10765,
            name: 'Sci-Fi & Fantasy'
        }])
    }, 'tv_season');
    assert.equal(stats.axes[0].name, '科幻与奇幻');
    assert.equal(stats.maximum, 16);
    assert.equal(stats.step, 4);
    assert.ok(stats.maximum >= stats.axes[0].count);
});
