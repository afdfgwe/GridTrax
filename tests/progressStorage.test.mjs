import assert from 'node:assert/strict';
import test from 'node:test';
import {createProgressStorage, PROGRESS_STORAGE_KEY as key} from '../src/utils/progressStorage.ts';

const value = id => JSON.stringify({state: {data: {user_id: id, last_sync: 0, records: {}}}, version: 0});

function fixture() {
    const map = new Map([[key, value('original')]]);
    let error = null;
    let failKey;
    const storage = {
        getItem: name => map.get(name) ?? null,
        setItem: (name, text) => {
            if (name === failKey) throw new Error('quota');
            map.set(name, text);
        },
    };
    const adapter = createProgressStorage(() => storage, message => {
        error = message;
    });
    return {
        adapter, map, get error() {
            return error;
        }, fail: name => {
            failKey = name;
        }
    };
}

test('日常保存失败保留旧记录并提示，成功重试清除错误', () => {
    const f = fixture();
    f.fail(key);
    f.adapter.setItem(key, value('changed'));
    assert.equal(f.map.get(key), value('original'));
    assert.match(f.error, /尚未保存/);
    f.fail(undefined);
    f.adapter.retry(value('changed'));
    assert.equal(f.error, null);
    assert.equal(f.map.get(key), value('changed'));
});

test('损坏的原记录不会被自动保存静默覆盖', () => {
    const f = fixture();
    f.map.set(key, '{broken');
    assert.equal(f.adapter.getItem(key), null);
    f.adapter.setItem(key, value('empty'));
    assert.equal(f.map.get(key), '{broken');
    assert.match(f.error, /读取失败/);
    f.adapter.replace(value('imported'), value('empty'));
    assert.equal(f.adapter.recovery().value, '{broken');
    assert.equal(f.map.get(key), value('imported'));
    assert.equal(f.error, null);
});

test('导入前保存当前内存快照，恢复时可保留被恢复前的数据', () => {
    const f = fixture();
    f.adapter.replace(value('imported'), value('unsaved-current'));
    const snapshot = f.adapter.recovery();
    assert.equal(snapshot.value, value('unsaved-current'));
    assert.ok(snapshot.saved_at > 0);
    f.adapter.replace(snapshot.value, value('imported'));
    assert.equal(f.map.get(key), value('unsaved-current'));
    assert.equal(f.adapter.recovery().value, value('imported'));
});

test('恢复快照或主记录保存失败均不能覆盖现有数据', () => {
    for (const failKey of ['gridtrax-progress-before-import', key]) {
        const f = fixture();
        f.fail(failKey);
        assert.throws(() => f.adapter.replace(value('imported'), value('original')));
        assert.equal(f.map.get(key), value('original'));
    }
    const f = fixture();
    assert.throws(() => f.adapter.replace('{}', value('original')));
    assert.equal(f.adapter.recovery(), null);
});
