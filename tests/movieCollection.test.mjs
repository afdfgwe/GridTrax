import test from 'node:test';
import assert from 'node:assert/strict';
import {getCollectionMovies} from '../src/utils/movieCollection.ts';

test('同系列电影按上映日期排列，未知及无效日期放在最后，不修改接口数据', () => {
    const parts = [
        {id: 3, title: '第三部', release_date: '2026-01-01'},
        {id: 4, title: '未定档', release_date: null},
        {id: 1, title: '第一部', release_date: '2000-01-01'},
        {id: 5, title: '无效日期', release_date: 'unknown'},
        {id: 2, title: '第二部', release_date: '2010-01-01'},
    ];
    const before = structuredClone(parts);
    assert.deepEqual(getCollectionMovies(parts).map(movie => movie.id), [1, 2, 3, 4, 5]);
    assert.deepEqual(parts, before);
});

test('同系列电影移除重复与无效编号，保留当前电影、缺海报和零评分条目', () => {
    const parts = [
        {id: 1, title: '当前影片', poster_path: null, vote_average: 0},
        {id: 1, title: '重复影片'},
        {id: 0, title: '无效编号'},
        null,
        {id: 2.5, title: '无效编号'},
        {id: 2, title: '下一部'},
    ];
    assert.deepEqual(getCollectionMovies(parts), [parts[0], parts[5]]);
    assert.deepEqual(getCollectionMovies([]), []);
});

test('合集保留全部电影，不沿用推荐列表的十部上限', () => {
    const parts = Array.from({length: 15}, (_, index) => ({id: index + 1, title: `电影${index + 1}`}));
    assert.equal(getCollectionMovies(parts).length, 15);
});
