import test from 'node:test';
import assert from 'node:assert/strict';
import {getTrendingInfo, toTrendingRows} from '../src/utils/trendingMovies.ts';

test('TMDB 日榜保留所有条目和接口顺序，直接使用影片 ID 且不混用豆瓣评分', () => {
    const movies = Array.from({length: 20}, (_, index) => ({
        id: 100 - index, title: `电影${index}`, original_title: `Movie ${index}`,
        release_date: '2026-10-20', vote_average: 8.3, genre_ids: [35, 53],
    }));
    const before = structuredClone(movies);
    const rows = toTrendingRows(movies);
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map(row => row.item.rank), Array.from({length: 20}, (_, index) => index + 1));
    assert.deepEqual(rows.map(row => row.movie.id), movies.map(movie => movie.id));
    assert.equal(rows[0].status, 'matched');
    assert.equal(rows[0].item.year, '2026');
    assert.equal(rows[0].item.rating, undefined);
    assert.equal(rows[0].movie.vote_average, 8.3);
    assert.deepEqual(movies, before);
});

test('TMDB 资料展示原名、完整上映日期和原始类型编号', () => {
    assert.deepEqual(getTrendingInfo({id: 1, title: '害群之马', original_title: 'Bad Apples',
        release_date: '2026-09-10', genre_ids: [35, 53]}), [
        {label: '原名', value: 'Bad Apples'},
        {label: '上映', value: '2026-09-10'},
        {label: '类型', value: '35 / 53'},
    ]);
});

test('TMDB 缺失字段、空数组和空白内容不占资料行，空榜单不伪造影片', () => {
    assert.deepEqual(getTrendingInfo(), []);
    assert.deepEqual(getTrendingInfo({id: 1, title: '电影', original_title: ' ', release_date: '', genre_ids: []}), []);
    assert.deepEqual(toTrendingRows([]), []);
    assert.equal(toTrendingRows([{id: 1, title: '电影'}])[0].item.year, undefined);
    assert.equal(toTrendingRows([{id: 1, title: '电影', release_date: ''}])[0].item.year, undefined);
});
