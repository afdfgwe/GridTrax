import assert from 'node:assert/strict';
import test from 'node:test';
import {getMediaScore, getMediaScores} from '../src/utils/mediaScores.ts';

const seasonRecord = (season_number, extra = {}) => ({type: 'tv_season', tmdb_id: 10, season_number, ...extra});

test('只有一季时使用整部剧评分，不使用本季评分，也不修改接口数据', () => {
    const detail = {
        id: 10, number_of_seasons: 1, vote_average: 8.3,
        seasons: [{season_number: 1, vote_average: 9.5}]
    };
    const before = structuredClone(detail);
    const scores = getMediaScores(detail);
    assert.deepEqual(scores, {'tv_season-10': 8.3});
    assert.equal(getMediaScore(seasonRecord(1), scores), 8.3);
    assert.deepEqual(detail, before);
});

test('单季剧整部评分无效时隐藏评分，不改用本季评分', () => {
    for (const vote_average of [0, undefined, null, NaN, Infinity, -1]) {
        const scores = getMediaScores({
            id: 10, number_of_seasons: 1, vote_average,
            seasons: [{season_number: 1, vote_average: 9}]
        });
        assert.equal(getMediaScore(seasonRecord(1), scores), 0);
    }
});

test('总季数缺失时按正片季数判断，特别篇不将单季剧变成多季剧', () => {
    for (const number_of_seasons of [undefined, null, 1]) {
        const scores = getMediaScores({
            id: 10, number_of_seasons, vote_average: 8,
            seasons: [{season_number: 0, vote_average: 9}, {season_number: 1, vote_average: 9.5}]
        });
        assert.equal(getMediaScore(seasonRecord(1), scores), 8);
        assert.equal(getMediaScore(seasonRecord(0), scores), 8);
    }
    const scores = getMediaScores({
        id: 10, vote_average: 8,
        seasons: [{season_number: 1, vote_average: 9.5}]
    });
    assert.equal(getMediaScore(seasonRecord(1), scores), 8);
});

test('接口总季数为多季时，摘要仅含一季也保留该季评分', () => {
    const scores = getMediaScores({
        id: 10, number_of_seasons: 2, vote_average: 8,
        seasons: [{season_number: 1, vote_average: 9.5}]
    });
    assert.equal(getMediaScore(seasonRecord(1), scores), 9.5);
    assert.equal(getMediaScore(seasonRecord(2), scores), 8);
});

test('单季剧按整剧评分排序，与显示的分数一致', () => {
    const movie = {type: 'movie', tmdb_id: 20};
    const records = [seasonRecord(1), movie];
    const scores = {
        ...getMediaScores({
            id: 10, number_of_seasons: 1, vote_average: 7,
            seasons: [{season_number: 1, vote_average: 9.5}]
        }),
        ...getMediaScores({id: 20, vote_average: 8}),
    };
    assert.deepEqual([...records].sort((a, b) => getMediaScore(b, scores) - getMediaScore(a, scores)),
        [movie, seasonRecord(1)]);
});

test('同剧多季优先各自评分，季评分可以低于整部剧评分，且不修改源数据', () => {
    const detail = {
        id: 10, vote_average: 8, seasons: [
            {season_number: 2, vote_average: 6.5},
            {season_number: 1, vote_average: 9.2},
        ]
    };
    const before = structuredClone(detail);
    const scores = getMediaScores(detail);
    assert.equal(getMediaScore(seasonRecord(1), scores), 9.2);
    assert.equal(getMediaScore(seasonRecord(2), scores), 6.5);
    assert.deepEqual(detail, before);
});

test('季评分为零、缺失或无效时回退整部剧，摘要没有该季也可回退', () => {
    const invalid = [0, undefined, null, NaN, Infinity, -1, '9.5'];
    const scores = getMediaScores({
        id: 10, vote_average: 8, seasons: invalid.map((vote_average, index) => ({
            season_number: index + 1, vote_average,
        }))
    });
    for (let season = 1; season <= invalid.length + 1; season++) {
        assert.equal(getMediaScore(seasonRecord(season), scores), 8);
    }
});

test('整部剧没有评分时仍展示有效季评分，两者都无效则返回零供界面隐藏', () => {
    for (const vote_average of [0, undefined, null, NaN, Infinity, -1]) {
        const scores = getMediaScores({
            id: 10, vote_average, seasons: [
                {season_number: 1, vote_average: 9},
                {season_number: 2, vote_average: 0},
            ]
        });
        assert.equal(getMediaScore(seasonRecord(1), scores), 9);
        assert.equal(getMediaScore(seasonRecord(2), scores), 0);
        assert.equal(getMediaScore(seasonRecord(99), scores), 0);
    }
    assert.equal(getMediaScore(seasonRecord(1), {}), 0);
});

test('特别篇、同编号电影和不同电视剧评分互不干扰，不使用历史个人评分', () => {
    const scores = {
        ...getMediaScores({id: 10, vote_average: 8, seasons: [{season_number: 0, vote_average: 9}]}),
        ...getMediaScores({id: 10, vote_average: 7}),
        ...getMediaScores({id: 100, vote_average: 6, seasons: []}),
    };
    assert.equal(getMediaScore(seasonRecord(0), scores), 9);
    assert.equal(getMediaScore(seasonRecord(1, {rating: 10}), scores), 8);
    assert.equal(getMediaScore(seasonRecord(1, {tmdb_id: 100}), scores), 6);
    assert.equal(getMediaScore({type: 'movie', tmdb_id: 10}, scores), 7);
    assert.equal(getMediaScore({type: 'movie', tmdb_id: 20, rating: 10}, scores), 0);
});

test('评分排序与显示使用同一取值规则，同剧各季可以分开排序', () => {
    const records = [seasonRecord(1), seasonRecord(2), seasonRecord(3)];
    const scores = getMediaScores({
        id: 10, vote_average: 8, seasons: [
            {season_number: 1, vote_average: 6},
            {season_number: 2, vote_average: 9},
            {season_number: 3, vote_average: 0},
        ]
    });
    assert.deepEqual([...records].sort((a, b) => getMediaScore(b, scores) - getMediaScore(a, scores))
        .map(record => record.season_number), [2, 3, 1]);
});

test('电影没有有效评分时返回零', () => {
    for (const vote_average of [0, undefined, null, NaN, Infinity, -1]) {
        assert.equal(getMediaScore({type: 'movie', tmdb_id: 10}, getMediaScores({id: 10, vote_average})), 0);
    }
});
