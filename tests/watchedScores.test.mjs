import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedScoreStats} from '../src/utils/stats/watchedScores.ts';
import {buildWatchedStats} from '../src/utils/stats/watchedStats.ts';
import {toMediaMetadata} from '../src/utils/media/mediaMetadataCache.ts';

const movie = (id, global_status = 'Collect') => ({type: 'movie', tmdb_id: id, global_status});
const season = (id, season_number) => ({type: 'tv_season', tmdb_id: id, season_number, global_status: 'Collect'});
const metadata = (id, score) => toMediaMetadata({id, vote_average: score});

test('评分按原始值分入十个固定区间，整分进入新档，10 分纳入最后一档', () => {
    const scores = [0.1, 0.99, 1, 6.999, 7, 7.96, 8, 8.999, 9, 10];
    const records = scores.map((_, index) => movie(index + 1));
    const data = Object.fromEntries(scores.map((score, index) => [`movie-${index + 1}`, metadata(index + 1, score)]));
    const before = structuredClone({records, data});
    const stats = buildWatchedScoreStats(records, data);
    assert.equal(stats.total, 10);
    assert.equal(stats.coverageCount, 6);
    assert.deepEqual(stats.rows.map(row => [row.key, row.records.length]), [
        ['0', 2], ['1', 1], ['2', 0], ['3', 0], ['4', 0], ['5', 0], ['6', 1], ['7', 2], ['8', 2], ['9', 2],
    ]);
    assert.deepEqual(stats.rows[7].records.map(record => record.tmdb_id), [5, 6]);
    assert.deepEqual(stats.rows[9].records.map(record => record.tmdb_id), [9, 10]);
    assert.deepEqual({records, data}, before);
});

test('缺失、零、非法和越界评分不进入列表、平均分、占比或数量，不使用个人评分', () => {
    const scores = [undefined, null, 0, -1, NaN, Infinity, 10.01, '8', 8];
    const records = scores.map((_, index) => ({...movie(index + 1), rating: 10}));
    const data = Object.fromEntries(scores.map((score, index) => [`movie-${index + 1}`, metadata(index + 1, score)]));
    // 加载中的资料不应被归入最低评分档。
    records.push(movie(99));
    const stats = buildWatchedScoreStats(records, data);
    assert.equal(stats.resolved, 9);
    assert.equal(stats.sourceTotal, 10);
    assert.equal(stats.total, 1);
    assert.equal(stats.assignments, 1);
    assert.equal(stats.averageScore, 8);
    assert.equal(stats.highScoreCount, 1);
    assert.equal(stats.highScoreShare, 1);
    assert.deepEqual(stats.records.map(record => record.tmdb_id), [9]);
    assert.equal(stats.rows[0].records.length, 0);
    assert.equal(stats.rows[8].share, 1);
});

test('平均评分按看过记录等权计算，8 分及以上占比使用有评分记录作分母', () => {
    const records = [movie(1), movie(2), movie(3), season(4, 1)];
    const data = {
        'movie-1': metadata(1, 7.96), 'movie-2': metadata(2, 8), 'movie-3': metadata(3, 0),
        'tv_season-4': toMediaMetadata({id: 4, number_of_seasons: 1, vote_average: 9, seasons: []}),
    };
    const stats = buildWatchedStats(records, data, 'all', 'score');
    assert.equal(stats.averageScore, (7.96 + 8 + 9) / 3);
    assert.equal(stats.highScoreCount, 2);
    assert.equal(stats.highScoreShare, 2 / 3);
    assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 1);
    assert.equal(stats.movies, 2);
    assert.equal(stats.seasons, 1);
    assert.equal(stats.shows, 1);
});

test('多季剧采用本季评分，缺失时回退整剧；单季剧沿用整剧评分', () => {
    const records = [season(1, 1), season(1, 2), season(2, 1), season(3, 1)];
    const data = {
        'tv_season-1': toMediaMetadata({
            id: 1, vote_average: 7.5, number_of_seasons: 2, seasons: [
                {season_number: 1, vote_average: 9.2}, {season_number: 2, vote_average: 0},
            ]
        }),
        'tv_season-2': toMediaMetadata({
            id: 2, vote_average: 8.2, number_of_seasons: 1, seasons: [
                {season_number: 1, vote_average: 10},
            ]
        }),
        'tv_season-3': toMediaMetadata({
            id: 3, vote_average: 0, number_of_seasons: 1, seasons: [
                {season_number: 1, vote_average: 9},
            ]
        }),
    };
    const stats = buildWatchedScoreStats(records, data);
    assert.equal(stats.total, 3);
    assert.equal(stats.shows, 2);
    assert.equal(stats.rows[7].seasons, 1);
    assert.equal(stats.rows[8].seasons, 1);
    assert.equal(stats.rows[9].seasons, 1);
    assert.equal(stats.averageScore, (9.2 + 7.5 + 8.2) / 3);
});

test('仅统计看过并按电影/季去重，类别筛选保持独立，不依赖类型地区年份语言', () => {
    const records = [movie(1), movie(1), movie(2, 'Wish'), season(3, 1), season(3, 1), season(3, 2)];
    const data = {
        'movie-1': metadata(1, 8.5), 'movie-2': metadata(2, 9),
        'tv_season-3': toMediaMetadata({id: 3, vote_average: 7, number_of_seasons: 2, seasons: []}),
    };
    for (const [kind, total, movies, seasons, shows] of [['all', 3, 1, 2, 1], ['movie', 1, 1, 0, 0], ['tv_season', 2, 0, 2, 1]]) {
        const stats = buildWatchedScoreStats(records, data, kind);
        assert.equal(stats.total, total);
        assert.equal(stats.movies, movies);
        assert.equal(stats.seasons, seasons);
        assert.equal(stats.shows, shows);
        assert.equal(stats.sourceTotal, total);
    }
});

test('空数据和全部未评分时不出现 NaN、无穷大或未评分分类，保留十个零值档', () => {
    for (const records of [[], [movie(1), movie(2)]]) {
        const stats = buildWatchedScoreStats(records, {'movie-1': metadata(1, 0)});
        assert.equal(stats.total, 0);
        assert.equal(stats.averageScore, 0);
        assert.equal(stats.highScoreShare, 0);
        assert.equal(stats.coverageCount, 0);
        assert.equal(stats.rows.length, 10);
        assert.ok(stats.rows.every(row => row.share === 0 && row.records.length === 0));
        assert.deepEqual(stats.records, []);
    }
});

test('看过记录增加后重新统计，千条以上数据仍保持正确数量', () => {
    const records = Array.from({length: 1100}, (_, index) => movie(index + 1));
    const data = Object.fromEntries(records.map(record => [`movie-${record.tmdb_id}`, metadata(record.tmdb_id, 8)]));
    const before = buildWatchedScoreStats(records.slice(0, -1), data);
    const after = buildWatchedScoreStats(records, data);
    assert.equal(before.total, 1099);
    assert.equal(after.total, 1100);
    assert.equal(after.rows[8].movies, 1100);
    assert.equal(after.highScoreShare, 1);
});

test('最低评分人数包含门槛边界，图表、平均分、占比和列表同步筛选且不修改输入', () => {
    const records = [movie(1), movie(2), movie(3), movie(4)];
    const data = Object.fromEntries([[1, 10, 49], [2, 8, 50], [3, 6, 500], [4, 0, 1000]].map(([id, score, votes]) =>
        [`movie-${id}`, toMediaMetadata({id, vote_average: score, vote_count: votes})]));
    const before = structuredClone({records, data});
    const stats = buildWatchedStats(records, data, 'movie', 'score', [], 50);
    assert.equal(stats.sourceTotal, 4);
    assert.equal(stats.resolved, 4);
    assert.equal(stats.total, 2);
    assert.equal(stats.averageScore, 7);
    assert.equal(stats.movies, 2);
    assert.equal(stats.rows[8].share, 0.5);
    assert.equal(stats.rows[6].share, 0.5);
    assert.deepEqual(stats.records.map(record => record.tmdb_id), [2, 3]);
    assert.deepEqual(buildWatchedScoreStats(records, data, 'all', 500).records.map(record => record.tmdb_id), [3]);
    assert.deepEqual({records, data}, before);
});

test('不限人数时保留旧行为，非零门槛排除缺失、零和无效人数，全部排除后仍保留十个空档', () => {
    const counts = [undefined, null, 0, -1, 1.5, '100', NaN, Infinity, 100];
    const records = counts.map((_, index) => movie(index + 1));
    const data = Object.fromEntries(counts.map((vote_count, index) =>
        [`movie-${index + 1}`, toMediaMetadata({id: index + 1, vote_average: 8, vote_count})]));
    delete data['movie-1'].voteCount;
    assert.equal(buildWatchedScoreStats(records, data).total, 9);
    const filtered = buildWatchedScoreStats(records, data, 'all', 50);
    assert.equal(filtered.total, 1);
    assert.equal(filtered.resolved, 8);
    assert.deepEqual(filtered.records.map(record => record.tmdb_id), [9]);
    const empty = buildWatchedScoreStats(records, data, 'all', 500);
    assert.equal(empty.total, 0);
    assert.equal(empty.averageScore, 0);
    assert.equal(empty.rows.length, 10);
    assert.ok(empty.rows.every(row => row.share === 0 && row.records.length === 0));
});

test('电视剧用整剧人数筛选所有季，不改变本季评分和单季剧评分规则，其他维度不受影响', () => {
    const records = [season(1, 1), season(1, 2), season(2, 1), movie(3)];
    const data = {
        'tv_season-1': toMediaMetadata({id: 1, vote_average: 7.5, vote_count: 100, number_of_seasons: 2,
            seasons: [{season_number: 1, vote_average: 9.2, vote_count: 1}, {season_number: 2, vote_average: 0}]}),
        'tv_season-2': toMediaMetadata({id: 2, vote_average: 8.2, vote_count: 49, number_of_seasons: 1,
            seasons: [{season_number: 1, vote_average: 10, vote_count: 999}]}),
        'movie-3': toMediaMetadata({id: 3, vote_average: 6, vote_count: 1000, genres: [{id: 18, name: '剧情'}]}),
    };
    const stats = buildWatchedScoreStats(records, data, 'tv_season', 50);
    assert.equal(stats.seasons, 2);
    assert.equal(stats.shows, 1);
    assert.equal(stats.averageScore, (9.2 + 7.5) / 2);
    assert.equal(stats.rows[9].seasons, 1);
    assert.equal(stats.rows[7].seasons, 1);
    assert.equal(buildWatchedScoreStats(records, data, 'movie', 50).movies, 1);
    assert.deepEqual(buildWatchedStats(records, data, 'all', 'genre', [], 500), buildWatchedStats(records, data));
});
