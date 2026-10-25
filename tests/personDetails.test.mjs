import assert from 'node:assert/strict';
import test from 'node:test';
import {loadPersonDetails} from '../src/api/personDetails.ts';
import {createRequestCache} from '../src/utils/requestCache.ts';

// 使用不同语言的模拟响应覆盖简介回退，不依赖真实接口或访问凭据。
test('中文简介存在时不额外请求英文资料', async () => {
    const person = {id: 1247604, name: '中文姓名', biography: ' 中文简介 '};
    const calls = [];
    const result = await loadPersonDetails(async language => {
        calls.push(language);
        return person;
    });
    assert.equal(result, person);
    assert.deepEqual(calls, ['zh-CN']);
});

for (const biography of ['', ' \n\t ', null, undefined]) {
    test(`中文简介为 ${JSON.stringify(biography)} 时仅补充英文简介`, async () => {
        const person = Object.freeze({
            id: 1247604, name: '中文姓名', biography,
            also_known_as: ['中文别名'], birthday: '1980-01-01',
        });
        const english = Object.freeze({
            id: 1247604, name: 'English Name', biography: ' English biography. ',
            also_known_as: ['English Alias'], birthday: null,
        });
        const calls = [];
        const result = await loadPersonDetails(async language => {
            calls.push(language);
            return language === 'zh-CN' ? person : english;
        });
        assert.deepEqual(calls, ['zh-CN', 'en-US']);
        assert.deepEqual(result, {...person, biography: 'English biography.'});
        assert.equal(person.biography, biography);
        assert.equal(english.biography, ' English biography. ');
    });
}

test('中英文简介都缺失时保留中文资料，不产生空简介占位', async () => {
    const person = {id: 1, name: '中文姓名', biography: ''};
    for (const biography of ['', ' \n ', null, undefined]) {
        const result = await loadPersonDetails(async language =>
            language === 'zh-CN' ? person : {id: 1, name: 'English Name', biography});
        assert.equal(result, person);
    }
});

test('英文补充请求失败不影响中文资料展示', async () => {
    const person = {id: 1, name: '中文姓名', biography: ''};
    const result = await loadPersonDetails(async language => {
        if (language === 'en-US') throw new Error('网络超时');
        return person;
    });
    assert.equal(result, person);
});

test('中文请求失败仍交由页面处理错误，不继续请求英文', async () => {
    const calls = [];
    const error = new Error('中文请求失败');
    await assert.rejects(loadPersonDetails(async language => {
        calls.push(language);
        throw error;
    }), failure => failure === error);
    assert.deepEqual(calls, ['zh-CN']);
});

test('缓存共享整组中英文请求，五分钟后重新获取简介', async () => {
    let now = 0;
    const cache = createRequestCache(40, 5 * 60_000, () => now);
    const calls = [];
    const load = () => cache.load('person:1:zh-CN', () => loadPersonDetails(async language => {
        calls.push(language);
        return {id: 1, name: '中文姓名', biography: language === 'en-US' ? 'English biography.' : ''};
    }));
    const first = load();
    assert.equal(load(), first);
    assert.equal((await first).biography, 'English biography.');
    now = 5 * 60_000 - 1;
    assert.equal(load(), first);
    assert.deepEqual(calls, ['zh-CN', 'en-US']);
    now++;
    const refreshed = load();
    assert.notEqual(refreshed, first);
    await refreshed;
    assert.deepEqual(calls, ['zh-CN', 'en-US', 'zh-CN', 'en-US']);
});
