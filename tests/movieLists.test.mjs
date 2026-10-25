import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getMovieListRequest, MOVIE_LIST_LABELS, normalizeMovieListResponse, resolveMovieListKind,
} from '../src/utils/movieLists.ts';
import {toTrendingRows} from '../src/utils/trendingMovies.ts';

test('电影列表仅接受四种类型，旧电视剧及非法参数回退到正在热映', () => {
    for (const list of ['now_playing', 'popular', 'top_rated', 'upcoming']) {
        assert.equal(resolveMovieListKind(list), list);
        assert.ok(MOVIE_LIST_LABELS[list]);
    }
    for (const value of [null, '', 'airing_today', 'on_the_air', 'trending', '__proto__', 'constructor']) {
        assert.equal(resolveMovieListKind(value), 'now_playing');
    }
});

test('四个电影接口统一使用中文及中国地区，不发送电视剧时区参数', () => {
    for (const list of ['now_playing', 'popular', 'top_rated', 'upcoming']) {
        assert.deepEqual(getMovieListRequest(list, 2), {
            path: `/movie/${list}`, params: {language: 'zh-CN', region: 'CN', page: 2},
        });
    }
    assert.equal(getMovieListRequest('popular', 999).params.page, 500);
    assert.equal(getMovieListRequest('popular', NaN).params.page, 1);
});

test('电影保留分页及日期范围等附加字段，转换后标题、原名、年份和评分正确', () => {
    const response = {
        page: 2, total_pages: 800, total_results: 16000,
        dates: {minimum: '2026-10-01', maximum: '2026-10-31'},
        results: [{
            id: 9, title: '测试电影', original_title: 'Original Movie', release_date: '2026-10-01',
            vote_average: 8.5, genre_ids: [18], poster_path: '/poster.jpg', overview: '电影简介'
        }]
    };
    const before = structuredClone(response);
    const normalized = normalizeMovieListResponse(response);
    assert.equal(normalized.total_pages, 500);
    assert.equal(normalized.page, 2);
    assert.equal(normalized.total_results, 16000);
    assert.deepEqual(normalized.dates, response.dates);
    assert.deepEqual(response, before);
    const [row] = toTrendingRows(normalized.results, (normalized.page - 1) * 20);
    assert.equal(row.item.rank, 21);
    assert.equal(row.item.title, '测试电影');
    assert.equal(row.item.year, '2026');
    assert.equal(row.movie.original_title, 'Original Movie');
    assert.equal(row.movie.vote_average, 8.5);
    assert.equal(row.item.rating, undefined);
    assert.deepEqual(row.movie.genre_ids, [18]);
});

test('空电影列表有效，损坏的结果及分页元数据会报错', () => {
    const empty = {page: 1, results: [], total_pages: 0, total_results: 0};
    assert.deepEqual(normalizeMovieListResponse(empty), empty);
    for (const response of [null, {}, {...empty, results: null}, {...empty, page: 0}, {...empty, page: 501},
        {...empty, total_pages: -1}, {...empty, total_pages: 2.5}, {...empty, total_results: '10'}]) {
        assert.throws(() => normalizeMovieListResponse(response), /电影列表格式错误/);
    }
});
