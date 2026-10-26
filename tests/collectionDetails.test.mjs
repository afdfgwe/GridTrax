import assert from 'node:assert/strict';
import test from 'node:test';
import {loadCollectionDetails} from '../src/api/collectionDetails.ts';
import {createRequestCache} from '../src/utils/requestCache.ts';

// 模拟两种语言的响应，不依赖真实网络或访问凭据。
test('合集有中文简介时只请求中文资料', async () => {
    const collection = {id: 70068, name: '叶问（系列）', overview: ' 中文简介 ', parts: []};
    const calls = [];
    const result = await loadCollectionDetails(async language => {
        calls.push(language);
        return collection;
    });
    assert.equal(result, collection);
    assert.deepEqual(calls, ['zh-CN']);
});

for (const overview of ['', ' \n\t ', null, undefined]) {
    test(`合集中文简介为 ${JSON.stringify(overview)} 时只补充英文简介`, async () => {
        const parts = Object.freeze([{id: 14756, title: '叶问', overview: '中文电影简介'}]);
        const collection = Object.freeze({
            id: 70068, name: '叶问（系列）', original_name: '葉問（系列）', overview,
            poster_path: '/zh-poster.jpg', backdrop_path: '/zh-backdrop.jpg', parts,
        });
        const english = Object.freeze({
            id: 70068, name: 'Ip Man Collection', original_name: 'Ip Man Collection',
            overview: ' English collection overview. ', poster_path: '/en-poster.jpg',
            backdrop_path: '/en-backdrop.jpg', parts: [{id: 14756, title: 'Ip Man'}],
        });
        const calls = [];
        const result = await loadCollectionDetails(async language => {
            calls.push(language);
            return language === 'zh-CN' ? collection : english;
        });
        assert.deepEqual(calls, ['zh-CN', 'en-US']);
        assert.deepEqual(result, {...collection, overview: 'English collection overview.'});
        assert.equal(result.parts, parts);
        assert.equal(collection.overview, overview);
        assert.equal(english.overview, ' English collection overview. ');
    });
}

test('合集的中英文简介均缺失时保留中文资料', async () => {
    const collection = {id: 70068, name: '叶问（系列）', overview: '', parts: []};
    for (const overview of ['', ' \n ', null, undefined]) {
        const result = await loadCollectionDetails(async language => language === 'zh-CN'
            ? collection : {id: 70068, name: 'Ip Man Collection', overview, parts: []});
        assert.equal(result, collection);
    }
});

test('合集英文简介请求失败不影响中文合集和成员电影', async () => {
    const collection = {id: 70068, name: '叶问（系列）', parts: [{id: 14756, title: '叶问'}]};
    const result = await loadCollectionDetails(async language => {
        if (language === 'en-US') throw new Error('网络超时');
        return collection;
    });
    assert.equal(result, collection);
});

test('合集中文请求失败不继续请求英文，由页面提供重试', async () => {
    const calls = [];
    const error = new Error('中文请求失败');
    await assert.rejects(loadCollectionDetails(async language => {
        calls.push(language);
        throw error;
    }), failure => failure === error);
    assert.deepEqual(calls, ['zh-CN']);
});

test('合集中文成员列表格式错误时保持原有校验，不使用英文替换', async () => {
    for (const parts of [null, undefined, {}]) {
        const calls = [];
        await assert.rejects(loadCollectionDetails(async language => {
            calls.push(language);
            return {id: 70068, name: '叶问（系列）', parts};
        }), /合集列表格式错误/);
        assert.deepEqual(calls, ['zh-CN']);
    }
});

test('空合集仍可以补充英文简介，不依赖英文成员列表', async () => {
    const collection = {id: 70068, name: '空合集', parts: []};
    const result = await loadCollectionDetails(async language => language === 'zh-CN'
        ? collection : {id: 70068, name: 'Empty Collection', overview: 'English overview.'});
    assert.deepEqual(result, {...collection, overview: 'English overview.'});
});

test('合集缓存共享中英文整组请求，五分钟后重新获取', async () => {
    let now = 0;
    const cache = createRequestCache(40, 5 * 60_000, () => now);
    const calls = [];
    const load = () => cache.load('collection:70068:zh-CN', () => loadCollectionDetails(async language => {
        calls.push(language);
        return {id: 70068, name: '叶问（系列）', parts: [], overview: language === 'en-US' ? 'English overview.' : ''};
    }));
    const first = load();
    assert.equal(load(), first);
    assert.equal((await first).overview, 'English overview.');
    now = 5 * 60_000 - 1;
    assert.equal(load(), first);
    assert.deepEqual(calls, ['zh-CN', 'en-US']);
    now++;
    const refreshed = load();
    assert.notEqual(refreshed, first);
    await refreshed;
    assert.deepEqual(calls, ['zh-CN', 'en-US', 'zh-CN', 'en-US']);
});
