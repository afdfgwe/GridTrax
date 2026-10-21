import assert from 'node:assert/strict';
import test from 'node:test';
import {createMediaMetadataCache, MEDIA_METADATA_STORAGE_KEY, MEDIA_METADATA_TTL, toMediaMetadata} from '../src/utils/mediaMetadataCache.ts';
import {createHomeMediaDetailsLoader} from '../src/utils/homeMediaDetailsLoader.ts';

const movie = id => ({type: 'movie', tmdb_id: id, global_status: 'Collect', poster_path: '/saved.jpg'});
const season = (id, season_number) => ({type: 'tv_season', tmdb_id: id, season_number, global_status: 'Do'});
const detail = (id, vote_average = 8, release_date = '2020-01-01') => ({id, vote_average, release_date, poster_path: '/poster.jpg'});
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const storage = () => {
    const values = new Map();
    return {
        values,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    };
};

test('独立资料缓存跨实例恢复，过期仍可读取旧值，不写入观影记录或个人评分', () => {
    const disk = storage();
    disk.setItem('gridtrax-progress', '原始观影记录');
    let time = Date.now();
    const cache = createMediaMetadataCache(() => disk, () => time);
    const item = toMediaMetadata(detail(1), time);
    cache.set('movie-1', item);
    cache.flush();
    assert.equal(disk.getItem('gridtrax-progress'), '原始观影记录');
    const restored = createMediaMetadataCache(() => disk, () => time);
    assert.deepEqual(restored.get('movie-1'), item);
    assert.equal(restored.isFresh(item), true);
    time += MEDIA_METADATA_TTL;
    assert.equal(restored.isFresh(item), false);
    assert.deepEqual(restored.get('movie-1'), item);
    assert.deepEqual(Object.keys(item).sort(), ['fetchedAt', 'posterPath', 'scores', 'years']);
});

test('损坏缓存、非法字段、存储禁用和空间不足不影响原始观影记录', () => {
    const disk = storage();
    disk.setItem('gridtrax-progress', '原始观影记录');
    for (const raw of ['broken json', 'null', JSON.stringify({version: 999, entries: []})]) {
        disk.setItem(MEDIA_METADATA_STORAGE_KEY, raw);
        assert.equal(createMediaMetadataCache(() => disk).get('movie-1'), undefined);
    }
    disk.setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({version: 1, entries: [
        ['movie-1', toMediaMetadata(detail(1))],
        ['movie-2', {...toMediaMetadata(detail(2)), scores: {'movie-1': 9}}],
        ['movie-3', {...toMediaMetadata(detail(3)), years: {'movie-3': 'bad'}}],
    ]}));
    const cache = createMediaMetadataCache(() => disk);
    assert.equal(cache.get('movie-1').scores['movie-1'], 8);
    assert.equal(cache.get('movie-2'), undefined);
    assert.equal(cache.get('movie-3'), undefined);
    const blocked = createMediaMetadataCache(() => { throw new Error('disabled'); });
    assert.doesNotThrow(() => { blocked.set('movie-1', toMediaMetadata(detail(1))); blocked.flush(); });
    const full = createMediaMetadataCache(() => ({...disk, setItem() { throw new Error('quota'); }}));
    assert.doesNotThrow(() => { full.set('movie-1', toMediaMetadata(detail(1))); full.flush(); });
    assert.equal(disk.getItem('gridtrax-progress'), '原始观影记录');
});

test('缓存同时限制条数和序列化体积，容量淘汰不影响当前页面的数据', () => {
    const disk = storage();
    const cache = createMediaMetadataCache(() => disk);
    for (let id = 1; id <= 1100; id++) cache.set(`movie-${id}`, toMediaMetadata(detail(id)));
    cache.flush();
    assert.equal(JSON.parse(disk.getItem(MEDIA_METADATA_STORAGE_KEY)).entries.length, 1000);
    assert.equal(cache.get('movie-1'), undefined);
    assert.ok(cache.get('movie-1100'));
    cache.set('movie-2000', {...toMediaMetadata(detail(2000)), posterPath: 'x'.repeat(260_000)});
    cache.flush();
    assert.ok(disk.getItem(MEDIA_METADATA_STORAGE_KEY).length <= 250_000);
});

test('评分和年份首次快照同步恢复，新鲜缓存不重复请求，空海报可从缓存补齐', async () => {
    const disk = storage();
    const cache = createMediaMetadataCache(() => disk);
    cache.set('movie-1', toMediaMetadata(detail(1)));
    let calls = 0;
    const filled = [];
    const records = [{...movie(1), poster_path: undefined}];
    const loader = createHomeMediaDetailsLoader(records, {
        cache, load: async () => { calls++; return detail(1); }, fillPoster: (...args) => filled.push(args),
    });
    assert.equal(loader.getSnapshot().scores['movie-1'], 8);
    assert.equal(loader.getSnapshot().years['movie-1'], '2020');
    loader.update(records, () => []);
    loader.start();
    await tick();
    assert.equal(calls, 0);
    assert.equal(filled[0][1], '/poster.jpg');
    loader.stop();
});

test('四路持续补位，可见影片优先且支持滚动后的新优先级，不被单个慢请求阻塞', async () => {
    const cache = createMediaMetadataCache(storage);
    const records = Array.from({length: 10}, (_, i) => movie(i + 1));
    const jobs = new Map();
    const calls = [];
    let active = 0, peak = 0;
    let priority = ['movie-8', 'movie-7'];
    const loader = createHomeMediaDetailsLoader(records, {
        cache,
        load: record => {
            calls.push(record.tmdb_id);
            active++;
            peak = Math.max(peak, active);
            const job = deferred();
            jobs.set(record.tmdb_id, job);
            return job.promise.finally(() => active--);
        },
        fillPoster() {},
    });
    loader.update(records, () => priority);
    loader.start();
    await tick();
    assert.deepEqual(calls, [8, 7, 1, 2]);
    priority = ['movie-10'];
    jobs.get(7).resolve(detail(7));
    await tick();
    assert.deepEqual(calls, [8, 7, 1, 2, 10]);
    assert.equal(loader.getSnapshot().scores['movie-7'], 8);
    assert.equal(loader.getSnapshot().scores['movie-8'], undefined);
    loader.update(records.map(record => ({...record})), () => priority);
    assert.equal(calls.length, 5);
    // 已在进行的慢请求仍占一个槽位，其他三个槽位继续补全所有非可见记录。
    for (let i = 0; i < 10; i++) {
        for (const [id, job] of jobs) if (id !== 8) job.resolve(detail(id));
        await tick();
    }
    jobs.get(8).resolve(detail(8));
    await tick();
    assert.equal(peak, 4);
    assert.equal(new Set(calls).size, 10);
    assert.equal(calls.length, 10);
    assert.equal(Object.keys(loader.getSnapshot().scores).length, 10);
    loader.stop();
});

test('多季去重，保留每季年份及评分回退规则；后台更新会移除过时字段', async () => {
    const cache = createMediaMetadataCache(storage);
    const old = {id: 5, number_of_seasons: 2, vote_average: 8, seasons: [
        {season_number: 1, vote_average: 9, air_date: '2004-08-05'},
        {season_number: 2, vote_average: 7, air_date: '2006-11-20'},
    ]};
    cache.set('tv_season-5', toMediaMetadata(old, Date.now() - MEDIA_METADATA_TTL - 1));
    const records = [season(5, 1), season(5, 2)];
    let calls = 0;
    const loader = createHomeMediaDetailsLoader(records, {
        cache, load: async () => { calls++; return {...old, number_of_seasons: 1, seasons: [{season_number: 1}]}; }, fillPoster() {},
    });
    assert.equal(loader.getSnapshot().years['tv_season-5-2'], '2006');
    assert.equal(loader.getSnapshot().scores['tv_season-5-1'], 9);
    loader.update(records, () => []);
    loader.start();
    await tick();
    assert.equal(calls, 1);
    assert.deepEqual(loader.getSnapshot().scores, {'tv_season-5': 8});
    assert.deepEqual(loader.getSnapshot().years, {'tv_season-5-1': ''});
    loader.stop();
});

test('同剧部分季缺海报时，即使去重代表记录已有海报，也会使用缓存补齐', async () => {
    const cache = createMediaMetadataCache(storage);
    cache.set('tv_season-5', toMediaMetadata({id: 5, seasons: [], poster_path: '/show.jpg'}));
    const records = [season(5, 1), {...season(5, 2), poster_path: '/season2.jpg'}];
    const filled = [];
    let calls = 0;
    const loader = createHomeMediaDetailsLoader(records, {
        cache, load: async () => { calls++; throw new Error('不应请求接口'); },
        fillPoster: (record, posterPath) => filled.push([record.tmdb_id, posterPath]),
    });
    loader.update(records, () => []);
    loader.start();
    await tick();
    assert.equal(calls, 0);
    assert.deepEqual(filled, [[5, '/show.jpg']]);
    loader.stop();
});

test('后台失败保留过期资料，重试只请求失败影片，不重发成功请求', async () => {
    const cache = createMediaMetadataCache(storage);
    cache.set('movie-1', toMediaMetadata(detail(1, 7), Date.now() - MEDIA_METADATA_TTL - 1));
    const calls = [];
    const records = [movie(1), movie(2)];
    const loader = createHomeMediaDetailsLoader(records, {
        cache,
        load: async record => {
            calls.push(record.tmdb_id);
            if (record.tmdb_id === 1 && calls.filter(id => id === 1).length === 1) throw new Error('offline');
            return detail(record.tmdb_id, 9);
        },
        fillPoster() {},
    });
    loader.update(records, () => []);
    loader.start();
    await tick();
    assert.equal(loader.getSnapshot().failedCount, 1);
    assert.equal(loader.getSnapshot().scores['movie-1'], 7);
    loader.retry();
    await tick();
    assert.equal(loader.getSnapshot().failedCount, 0);
    assert.equal(loader.getSnapshot().scores['movie-1'], 9);
    assert.deepEqual(calls, [1, 2, 1]);
    loader.stop();
});

test('删除记录和卸载后忽略页面回写，重启不产生重复请求；订阅可取消', async () => {
    const cache = createMediaMetadataCache(storage);
    const jobs = new Map();
    const filled = [];
    const records = [movie(1), movie(2)];
    let notifications = 0;
    const loader = createHomeMediaDetailsLoader(records, {
        cache, load: record => {
            const job = deferred();
            jobs.set(record.tmdb_id, job);
            return job.promise;
        }, fillPoster: record => filled.push(record.tmdb_id),
    });
    const unsubscribe = loader.subscribe(() => notifications++);
    loader.update(records, () => []);
    loader.start();
    loader.stop();
    loader.start();
    await tick();
    assert.equal(jobs.size, 2);
    loader.update([records[1]], () => []);
    jobs.get(1).resolve(detail(1));
    await tick();
    assert.deepEqual(filled, []);
    loader.stop();
    unsubscribe();
    const count = notifications;
    jobs.get(2).resolve(detail(2));
    await tick();
    assert.equal(notifications, count);
    assert.deepEqual(filled, []);
    assert.ok(cache.get('movie-2'));
});
