import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSearchResults} from '../src/utils/searchResults.ts';

const response = (results = [], total_pages = 1, page = 1) => ({results, total_pages, page});

test('综合搜索与合集搜索并行启动，分别保留顺序且不修改接口数据', async () => {
    const results = Object.freeze([{id: 1, media_type: 'movie'}, {id: 2, media_type: 'person'}]);
    const collections = Object.freeze([{id: 1, name: '同编号合集'}, {id: 3, name: '其他合集'}]);
    const started = [];
    let finishMulti;
    let finishCollections;
    const pending = loadSearchResults(1, () => {
        started.push('multi');
        return new Promise(resolve => {
            finishMulti = resolve;
        });
    }, () => {
        started.push('collection');
        return new Promise(resolve => {
            finishCollections = resolve;
        });
    });
    await Promise.resolve();
    assert.deepEqual(started, ['multi', 'collection']);
    finishCollections(response(collections));
    finishMulti(response(results, 5));
    const data = await pending;
    assert.equal(data.results, results);
    assert.equal(data.collections, collections);
    assert.equal(data.total_pages, 5);
    assert.equal(data.warning, undefined);
});

test('合集总页数更多时可继续翻页，综合搜索为空也能展示合集', async () => {
    const collections = [{id: 3, name: '合集'}];
    const data = await loadSearchResults(3, async () => response([], 2, 3),
        async () => response(collections, 6, 3));
    assert.equal(data.page, 3);
    assert.equal(data.total_pages, 6);
    assert.deepEqual(data.results, []);
    assert.deepEqual(data.collections, collections);
});

test('合集为空不影响影视结果，两边都为空时总页数为零', async () => {
    const movie = {id: 1, media_type: 'movie'};
    const data = await loadSearchResults(1, async () => response([movie], 5), async () => response([], 0));
    assert.deepEqual(data.results, [movie]);
    assert.deepEqual(data.collections, []);
    assert.equal(data.total_pages, 5);
    const empty = await loadSearchResults(1, async () => response([], 0), async () => response([], 0));
    assert.equal(empty.total_pages, 0);
    assert.equal(empty.warning, undefined);
});

test('合并后的分页不超过接口的五百页上限', async () => {
    const data = await loadSearchResults(1, async () => response([], 900), async () => response([], 800));
    assert.equal(data.total_pages, 500);
});

test('合集请求失败保留正常搜索结果，并提供可重试提示', async () => {
    const movie = {id: 1, media_type: 'movie'};
    const data = await loadSearchResults(1, async () => response([movie], 5), async () => {
        throw new Error('超时');
    });
    assert.deepEqual(data.results, [movie]);
    assert.deepEqual(data.collections, []);
    assert.equal(data.total_pages, 5);
    assert.match(data.warning, /合集搜索暂时失败/);
});

test('综合搜索失败时仍显示合集', async () => {
    const collections = [{id: 1, name: '合集'}];
    const data = await loadSearchResults(1, async () => {
        throw new Error('超时');
    }, async () => response(collections, 2));
    assert.deepEqual(data.results, []);
    assert.deepEqual(data.collections, collections);
    assert.equal(data.total_pages, 2);
    assert.match(data.warning, /当前仅显示合集/);
});

test('两个请求都失败时交给页面错误状态处理', async () => {
    const error = new Error('搜索失败');
    await assert.rejects(loadSearchResults(1, async () => {
            throw error;
        }, async () => {
            throw new Error('合集失败');
        }),
        failure => failure === error);
});
