import test from 'node:test';
import assert from 'node:assert/strict';
import {getTVListRequest, normalizeTVListResponse, resolveTVList, resolveTVListPage, TV_LIST_LABELS} from '../src/utils/tvLists.ts';
import {toTrendingRows} from '../src/utils/trendingMovies.ts';

test('电视剧列表只接受四种接口，未知网址参数回到趋势榜', () => {
    for (const list of ['airing_today', 'on_the_air', 'popular', 'top_rated']) {
        assert.equal(resolveTVList(list), list);
        assert.ok(TV_LIST_LABELS[list]);
    }
    for (const value of [null, '', 'trending', 'invalid', '__proto__', 'constructor']) {
        assert.equal(resolveTVList(value), 'trending');
    }
});

test('页码校验限制访问范围，非法值不进入请求', () => {
    for (const value of [null, '', 'abc', '1.5', NaN, Infinity, -3, 0]) {
        assert.equal(resolveTVListPage(value), 1);
    }
    assert.equal(resolveTVListPage('12'), 12);
    assert.equal(resolveTVListPage(500), 500);
    assert.equal(resolveTVListPage(501), 500);
});

test('四个列表使用专用接口和中文参数，只有播出列表固定使用北京时间', () => {
    for (const list of ['airing_today', 'on_the_air', 'popular', 'top_rated']) {
        const request = getTVListRequest(list, 2);
        assert.equal(request.path, `/tv/${list}`);
        assert.deepEqual(request.params, {
            language: 'zh-CN', page: 2,
            ...(['airing_today', 'on_the_air'].includes(list) ? {timezone: 'Asia/Shanghai'} : {}),
        });
    }
    assert.equal(getTVListRequest('popular', 999).params.page, 500);
});

test('列表保留接口顺序和分页元数据，不通过当前页条数推算总页数', () => {
    const response = {page: 2, results: [{id: 9, name: '第二页电视剧', first_air_date: '2020-01-01', vote_average: 8.5}], total_pages: 800, total_results: 16000};
    const before = structuredClone(response);
    const normalized = normalizeTVListResponse(response);
    assert.equal(normalized.total_pages, 500);
    assert.equal(normalized.page, 2);
    assert.equal(normalized.total_results, 16000);
    assert.deepEqual(response, before);
    const rows = toTrendingRows(normalized.results, (normalized.page - 1) * 20);
    assert.equal(rows[0].item.rank, 21);
    assert.equal(rows[0].item.title, '第二页电视剧');
    assert.equal(rows[0].item.year, '2020');
    assert.equal(rows[0].movie.vote_average, 8.5);
    assert.equal(rows[0].movie.id, 9);
});

test('列表允许空结果，拒绝损坏的分页数据', () => {
    const empty = {page: 1, results: [], total_pages: 0, total_results: 0};
    assert.deepEqual(normalizeTVListResponse(empty), empty);
    for (const response of [null, {}, {...empty, results: null}, {...empty, page: 0}, {...empty, page: 501},
        {...empty, total_pages: -1}, {...empty, total_pages: 2.5}, {...empty, total_results: '10'}]) {
        assert.throws(() => normalizeTVListResponse(response), /电视剧列表格式错误/);
    }
});
