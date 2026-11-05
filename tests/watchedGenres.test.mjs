import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedGenreStats, getWatchedRecords} from '../src/utils/stats/watchedGenres.ts';
import {createWatchedGenresLoader} from '../src/utils/stats/watchedGenresLoader.ts';
import {
    createMediaMetadataCache,
    MEDIA_METADATA_STORAGE_KEY,
    MEDIA_METADATA_TTL,
    toMediaMetadata
} from '../src/utils/media/mediaMetadataCache.ts';

const movie = (id, status = 'Collect') => ({type: 'movie', tmdb_id: id, global_status: status, name: `电影 ${id}`});
const season = (id, season_number, status = 'Collect') => ({
    type: 'tv_season',
    tmdb_id: id,
    season_number,
    global_status: status
});
const drama = {id: 18, name: '剧情'};
const action = {id: 28, name: '动作'};
const detail = (id, genres = [drama]) => ({
    id,
    release_date: '2020-01-01',
    vote_average: 8,
    genres,
    spoken_languages: [{iso_639_1: 'zh', name: '普通话', english_name: 'Mandarin'}],
    production_countries: []
});
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return {promise, resolve, reject};
};
const storage = () => {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
};

test('只统计看过，电影与同 ID 电视剧不串数据，多季独立计数且不修改输入', () => {
    const records = [movie(1), season(1, 1), season(1, 2), movie(2, 'Do'), movie(3, 'Wish')];
    const before = structuredClone(records);
    const stats = buildWatchedGenreStats(records, {
        'movie-1': toMediaMetadata(detail(1, [action])),
        'tv_season-1': toMediaMetadata(detail(1, [drama])),
    });
    assert.equal(stats.total, 3);
    assert.equal(stats.movies, 1);
    assert.equal(stats.seasons, 2);
    assert.equal(stats.shows, 1);
    assert.equal(stats.genreCount, 2);
    assert.equal(stats.rows[0].name, '剧情');
    assert.equal(stats.rows[0].share, 2 / 3);
    assert.equal(stats.rows[0].seasons, 2);
    assert.equal(stats.rows[1].movies, 1);
    assert.deepEqual(records, before);
    assert.equal(getWatchedRecords([...records, season(1, 1)]).length, 3);
});

test('多类型分别计数，同一类型去重，占比以筛选后的看过总数计算', () => {
    const records = [movie(1), movie(2), season(3, 1)];
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, [drama, action, drama])),
        'movie-2': toMediaMetadata(detail(2, [drama])),
        'tv_season-3': toMediaMetadata(detail(3, [drama])),
    };
    const stats = buildWatchedGenreStats(records, metadata, 'movie');
    assert.equal(stats.total, 2);
    assert.equal(stats.rows[0].records.length, 2);
    assert.equal(stats.rows[0].share, 1);
    assert.equal(stats.rows[1].share, 0.5);
    assert.equal(buildWatchedGenreStats(records, metadata, 'tv_season').total, 1);
    assert.equal(buildWatchedGenreStats([], {}).total, 0);
});

test('无类型、尚未加载和旧缓存不纳入统计；补齐中文类型名称', () => {
    const stats = buildWatchedGenreStats([movie(1), movie(2), movie(3), season(4, 1)], {
        'movie-1': toMediaMetadata(detail(1, [])),
        'movie-3': toMediaMetadata({id: 3, vote_average: 8}),
        'tv_season-4': toMediaMetadata(detail(4, [{id: 10765, name: 'Sci-Fi & Fantasy'}])),
    });
    assert.equal(stats.total, 1);
    assert.equal(stats.sourceTotal, 4);
    assert.equal(stats.resolved, 2);
    assert.equal(stats.genreCount, 1);
    assert.equal(stats.rows.length, 1);
    assert.equal(stats.rows[0].share, 1);
    assert.equal(stats.movies, 0);
    assert.equal(stats.seasons, 1);
    assert.equal(stats.shows, 1);
    assert.deepEqual(stats.records.map(record => record.tmdb_id), [4]);
    assert.ok(stats.rows.some(row => row.name === '科幻与奇幻'));
});

test('类型字段兼容旧缓存，恢复有效中文类型，拒绝损坏的类型资料', () => {
    const disk = storage();
    const old = toMediaMetadata({id: 1, vote_average: 7});
    const cached = toMediaMetadata(detail(2));
    disk.setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({
        version: 1, entries: [
            ['movie-1', old], ['movie-2', cached],
            ['movie-3', {...cached, genres: [{id: '18', name: '剧情'}]}],
            ['movie-4', {...cached, genres: [null]}],
        ]
    }));
    const cache = createMediaMetadataCache(() => disk);
    assert.equal(cache.get('movie-1').genres, undefined);
    assert.deepEqual(cache.get('movie-2').genres, [drama]);
    assert.equal(cache.get('movie-3'), undefined);
    assert.equal(cache.get('movie-4'), undefined);
});

test('八路并发持续补位，同剧多季只请求一次，不加载其他状态', async () => {
    const cache = createMediaMetadataCache(storage);
    const jobs = new Map();
    let active = 0, peak = 0;
    const records = Array.from({length: 9}, (_, i) => movie(i + 1));
    records.push(season(20, 1), season(20, 2), movie(30, 'Do'));
    const loader = createWatchedGenresLoader(records, {
        cache, load: record => {
            active++;
            peak = Math.max(peak, active);
            const job = deferred();
            jobs.set(record.tmdb_id, job);
            return job.promise.finally(() => active--);
        }
    });
    loader.start();
    await tick();
    assert.equal(jobs.size, 8);
    assert.equal(loader.getSnapshot().pendingCount, 10);
    jobs.get(1).resolve(detail(1));
    await tick();
    assert.equal(jobs.size, 9);
    for (let round = 0; round < 5; round++) {
        for (const [id, job] of jobs) job.resolve(detail(id));
        await tick();
    }
    assert.equal(peak, 8);
    assert.equal(jobs.size, 10);
    assert.equal(jobs.has(30), false);
    assert.equal(loader.getSnapshot().pendingCount, 0);
    assert.equal(Object.keys(loader.getSnapshot().metadata).length, 10);
    loader.stop();
});

test('同步读取新鲜缓存，不重复请求；旧缓存缺少类型时即使未过期也补全', async () => {
    const cache = createMediaMetadataCache(storage);
    cache.set('movie-1', toMediaMetadata(detail(1)));
    cache.set('movie-2', toMediaMetadata({id: 2, vote_average: 7}));
    const calls = [];
    const loader = createWatchedGenresLoader([movie(1), movie(2)], {
        cache, load: async record => {
            calls.push(record.tmdb_id);
            return detail(record.tmdb_id, []);
        }
    });
    assert.deepEqual(loader.getSnapshot().metadata['movie-1'].genres, [drama]);
    loader.start();
    await tick();
    loader.update([movie(1), movie(2)]);
    assert.deepEqual(calls, [2]);
    assert.deepEqual(loader.getSnapshot().metadata['movie-2'].genres, []);
    loader.stop();
});

test('过期缓存先展示，失败保留旧资料，重试不重发成功请求且不改观看记录', async () => {
    const disk = storage();
    disk.setItem('gridtrax-progress', '原始观影记录');
    const cache = createMediaMetadataCache(() => disk);
    cache.set('movie-1', toMediaMetadata(detail(1), Date.now() - MEDIA_METADATA_TTL - 1));
    const calls = [];
    const loader = createWatchedGenresLoader([movie(1), movie(2)], {
        cache, load: async record => {
            calls.push(record.tmdb_id);
            if (record.tmdb_id === 1 && calls.filter(id => id === 1).length === 1) throw Error('offline');
            return detail(record.tmdb_id, [action]);
        }
    });
    loader.start();
    await tick();
    assert.equal(loader.getSnapshot().failedCount, 1);
    assert.deepEqual(loader.getSnapshot().metadata['movie-1'].genres, [drama]);
    loader.retry();
    await tick();
    assert.equal(loader.getSnapshot().failedCount, 0);
    assert.deepEqual(calls, [1, 2, 1]);
    assert.deepEqual(loader.getSnapshot().metadata['movie-1'].genres, [action]);
    loader.stop();
    assert.equal(disk.getItem('gridtrax-progress'), '原始观影记录');
});

test('卸载停止排队，不发送页面通知，删除记录不残留；恢复可继续且无重复请求', async () => {
    const cache = createMediaMetadataCache(storage);
    const jobs = new Map();
    const records = Array.from({length: 10}, (_, i) => movie(i + 1));
    const loader = createWatchedGenresLoader(records, {
        cache, load: record => {
            const job = deferred();
            jobs.set(record.tmdb_id, job);
            return job.promise;
        }
    });
    let notifications = 0;
    const unsubscribe = loader.subscribe(() => notifications++);
    loader.start();
    await tick();
    loader.update(records.slice(1));
    loader.stop();
    const before = notifications;
    for (const [id, job] of jobs) job.resolve(detail(id));
    await tick();
    assert.equal(notifications, before);
    assert.equal(jobs.size, 8);
    loader.start();
    await tick();
    assert.equal(jobs.size, 10);
    assert.equal(loader.getSnapshot().metadata['movie-1'], undefined);
    jobs.get(9).resolve(detail(9));
    jobs.get(10).resolve(detail(10));
    await tick();
    assert.equal(Object.keys(loader.getSnapshot().metadata).length, 9);
    unsubscribe();
    loader.stop();
});

test('评分人数缓存兼容旧格式，保留零和未知人数，拒绝非法缓存并支持跨实例恢复', () => {
    const disk = storage();
    const base = toMediaMetadata(detail(1));
    const values = [undefined, null, 0, 500, -1, 1.5, '100'];
    disk.setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({version: 1,
        entries: values.map((voteCount, index) => [`movie-${index + 1}`, {...base, scores: {}, years: {}, voteCount}])}));
    const cache = createMediaMetadataCache(() => disk);
    assert.equal(cache.get('movie-1').voteCount, undefined);
    assert.equal(cache.get('movie-2').voteCount, null);
    assert.equal(cache.get('movie-3').voteCount, 0);
    assert.equal(cache.get('movie-4').voteCount, 500);
    for (const id of [5, 6, 7]) assert.equal(cache.get(`movie-${id}`), undefined);
    cache.set('movie-8', toMediaMetadata({...detail(8), vote_count: 123}));
    cache.flush();
    assert.equal(createMediaMetadataCache(() => disk).get('movie-8').voteCount, 123);
});

test('新鲜旧缓存缺少人数也补全，同剧多季只请求一次；未知人数确认后不反复补全', async () => {
    const cache = createMediaMetadataCache(storage);
    const old = toMediaMetadata({...detail(1), seasons: []});
    delete old.voteCount;
    cache.set('tv_season-1', old);
    const calls = [];
    const records = [season(1, 1), season(1, 2)];
    const load = async record => {
        calls.push(record.tmdb_id);
        return {...detail(1), seasons: []};
    };
    const loader = createWatchedGenresLoader(records, {cache, load});
    try {
        loader.start();
        await tick();
        loader.update(records);
        assert.deepEqual(calls, [1]);
        assert.equal(loader.getSnapshot().metadata['tv_season-1'].voteCount, null);
        assert.equal(loader.getSnapshot().pendingCount, 0);
    } finally { loader.stop(); }
    const next = createWatchedGenresLoader(records, {cache, load});
    try {
        next.start();
        await tick();
        assert.deepEqual(calls, [1]);
    } finally { next.stop(); }
});
