import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequestCache} from '../src/utils/requestCache.ts';
import {requestErrorMessage} from '../src/utils/requestError.ts';

// 覆盖请求缓存：并发去重、成功后才计时、失败立即淘汰、LRU 淘汰与竞态，以及网络错误提示文案。

// 注入可控时钟和未完成的 Promise，精确验证有效期边界，无需真实等待网络或计时器。
test('并发读取共用请求，成功后才开始计算有效期', async () => {
    let now = 0;
    let resolve;
    let calls = 0;
    const cache = createRequestCache(2, 100, () => now);
    const loader = () => {
        calls++;
        return new Promise(done => {
            resolve = done;
        });
    };
    const first = cache.load('movie:1', loader);
    assert.equal(first, cache.load('movie:1', loader));
    await Promise.resolve();
    now = 200;
    resolve({id: 1});
    await first;
    // 有效期从请求成功（now=200）起算 100ms：299 仍命中，300 已过期。
    now = 299;
    assert.equal(first, cache.load('movie:1', loader));
    now = 300;
    assert.notEqual(first, cache.load('movie:1', async () => {
        calls++;
        return {id: 1};
    }));
    await cache.load('movie:1', loader);
    assert.equal(calls, 2);
});

test('失败结果立即淘汰，后续读取可以重试', async () => {
    const cache = createRequestCache();
    await assert.rejects(cache.load('tv:1', async () => {
        throw new Error('offline');
    }));
    assert.equal(await cache.load('tv:1', async () => 'ok'), 'ok');
});

test('缓存按最近使用淘汰，并且不同资源不会串数据', async () => {
    const cache = createRequestCache(2);
    const first = cache.load('movie:1', async () => 1);
    await first;
    await cache.load('tv:1', async () => 2);
    assert.equal(cache.load('movie:1', async () => 9), first);
    await cache.load('season:1:2', async () => 3);
    assert.equal(await cache.load('tv:1', async () => 4), 4);
});

// 故意让旧请求晚于新请求创建后失败，覆盖缓存淘汰与异步回调交错的竞态。
test('已淘汰的旧请求失败不能删除同名新请求', async () => {
    const cache = createRequestCache(1);
    let reject;
    const old = cache.load('a', () => new Promise((_, fail) => {
        reject = fail;
    }));
    await Promise.resolve();
    await cache.load('b', async () => 2);
    const fresh = cache.load('a', async () => 3);
    reject(new Error('old'));
    await assert.rejects(old);
    await fresh;
    assert.equal(cache.load('a', async () => 4), fresh);
});

test('网络错误展示友好提示，不泄露请求内部数据', () => {
    assert.match(requestErrorMessage({response: {status: 401}}), /鉴权/);
    assert.match(requestErrorMessage({response: {status: 429}}), /频繁/);
    assert.match(requestErrorMessage({response: {status: 404}}), /未找到/);
    assert.match(requestErrorMessage({code: 'ECONNABORTED'}), /超时/);
    assert.match(requestErrorMessage(new Error('secret-token')), /网络/);
    assert.ok(!requestErrorMessage(new Error('secret-token')).includes('secret-token'));
});
