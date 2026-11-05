import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedRadarStats, getWatchedRadarHighlights, getWatchedRadarRatio, MIN_RADAR_AXIS_COUNT} from '../src/utils/stats/watchedRadar.ts';
import {toMediaMetadata} from '../src/utils/media/mediaMetadataCache.ts';

const movie = (id, global_status = 'Collect') => ({type: 'movie', tmdb_id: id, global_status});
const season = (id, number) => ({type: 'tv_season', tmdb_id: id, season_number: number, global_status: 'Collect'});
const detail = genres => toMediaMetadata({id: 1, genres});
const genre = id => ({id, name: `类型${id}`});

test('前三名高亮按真实数量排名，同量按编号排序且不改变轴顺序', () => {
    const axes = [
        {key: '28', name: '动作', count: 9, share: 0.9},
        {key: '12', name: '冒险', count: 9, share: 0.9},
        {key: '18', name: '剧情', count: 12, share: 1},
        {key: '35', name: '喜剧', count: 3, share: 0.3},
        {key: 'unknown', name: '未标注类型', count: 30, share: 1},
        null,
    ];
    const before = structuredClone(axes);
    assert.deepEqual([...getWatchedRadarHighlights(axes)], [['18', 1], ['12', 2], ['28', 3]]);
    assert.deepEqual(axes, before);
    assert.deepEqual([...getWatchedRadarHighlights([...axes].reverse())], [['18', 1], ['12', 2], ['28', 3]]);
});

test('高亮不足三类时只突出已有类型，空轴、未标注和零值不参与', () => {
    assert.equal(getWatchedRadarHighlights([null]).size, 0);
    assert.deepEqual([...getWatchedRadarHighlights([
        {key: '18', name: '剧情', count: 1, share: 1},
        {key: '35', name: '喜剧', count: 0, share: 0},
        {key: 'unknown', name: '未标注类型', count: 2, share: 1},
        null,
    ])], [['18', 1]]);
});

test('雷达图按类型编号展示全部类型，保留完整分母，不修改输入', () => {
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

test('观看量变化不改变类型顺序，排除未标注类型，刻度覆盖非首轴的最大值', () => {
    const records = Array.from({length: 9}, (_, index) => movie(index + 1));
    const metadata = Object.fromEntries(records.map(record => [`movie-${record.tmdb_id}`,
        detail(record.tmdb_id === 9 ? [] : record.tmdb_id === 1 ? [genre(12), genre(28)] : [genre(28)])]));
    const first = buildWatchedRadarStats(records, metadata, 'movie');
    assert.deepEqual(first.axes.filter(Boolean).map(axis => axis.key), ['12', '28']);
    assert.deepEqual(first.axes.filter(Boolean).map(axis => axis.count), [1, 8]);
    assert.equal(first.maximum, 8);
    const second = buildWatchedRadarStats(records.slice(0, 2), metadata, 'movie');
    assert.deepEqual(second.axes.filter(Boolean).map(axis => axis.key), ['12', '28']);
    assert.equal(first.axes[1].share, 1);
    assert.equal(first.total, 8);
    assert.equal(first.sourceTotal, 9);
});

test('平方根半径保留真实比例次序，低值更清晰，网格刻度可按数量反算', () => {
    assert.equal(getWatchedRadarRatio(0, 100), 0);
    assert.equal(getWatchedRadarRatio(4, 100), 0.2);
    assert.equal(getWatchedRadarRatio(25, 100), 0.5);
    assert.equal(getWatchedRadarRatio(100, 100), 1);
    let previous = -1;
    for (const count of [0, 1, 4, 25, 50, 75, 100]) {
        const ratio = getWatchedRadarRatio(count, 100);
        assert.ok(ratio > previous);
        assert.ok(Math.abs(ratio ** 2 * 100 - count) < 1e-10);
        previous = ratio;
    }
});

test('平方根刻度对无效数量或上限不生成异常坐标，超出上限时限制半径', () => {
    for (const [count, maximum] of [[-1, 100], [NaN, 100], [Infinity, 100], [1, 0], [1, -1], [1, NaN], [1, Infinity]]) {
        assert.equal(getWatchedRadarRatio(count, maximum), 0);
    }
    assert.equal(getWatchedRadarRatio(101, 100), 1);
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

test('未标注类型和尚未加载的资料不参与雷达统计及占比分母，不足六轴补空轴', () => {
    const stats = buildWatchedRadarStats([movie(1), movie(2), movie(3)], {
        'movie-1': detail([genre(18)]), 'movie-2': detail([]),
    }, 'movie');
    assert.equal(stats.total, 1);
    assert.equal(stats.sourceTotal, 3);
    assert.equal(stats.resolved, 2);
    assert.equal(stats.genreCount, 1);
    const known = stats.axes.find(axis => axis?.key === '18');
    const unknown = stats.axes.find(axis => axis?.key === 'unknown');
    assert.equal(known.share, 1);
    assert.equal(unknown, undefined);
    assert.equal(stats.axes.filter(axis => axis === null).length, MIN_RADAR_AXIS_COUNT - 1);
});

test('空记录和全部未加载时不生成虚构维度', () => {
    for (const records of [[], [movie(1)]]) {
        const metadata = {};
        const stats = buildWatchedRadarStats(records, metadata, 'movie');
        assert.deepEqual(stats.axes, Array(MIN_RADAR_AXIS_COUNT).fill(null));
        assert.equal(stats.genreCount, 0);
        assert.equal(stats.total, 0);
        assert.equal(stats.maximum, 4);
    }
});

test('全部为未标注类型时不生成雷达数据，并且电影、电视剧加载总数隔离', () => {
    const records = [movie(1), season(1, 1), season(1, 2)];
    const metadata = {'movie-1': detail([]), 'tv_season-1': detail([])};
    for (const [kind, count] of [['movie', 1], ['tv_season', 2]]) {
        const stats = buildWatchedRadarStats(records, metadata, kind);
        assert.equal(stats.genreCount, 0);
        assert.equal(stats.sourceTotal, count);
        assert.equal(stats.total, 0);
        assert.deepEqual(stats.axes, Array(MIN_RADAR_AXIS_COUNT).fill(null));
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
