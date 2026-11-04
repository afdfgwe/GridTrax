import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedStats, UNKNOWN_STAT} from '../src/utils/stats/watchedStats.ts';
import {allocateLanguageCells} from '../src/utils/stats/languageWaffle.ts';
import {createWatchedGenresLoader} from '../src/utils/stats/watchedGenresLoader.ts';
import {createMediaMetadataCache, MEDIA_METADATA_STORAGE_KEY, toMediaMetadata} from '../src/utils/media/mediaMetadataCache.ts';

const movie = (id, status = 'Collect') => ({type: 'movie', tmdb_id: id, global_status: status});
const season = (id, n) => ({type: 'tv_season', tmdb_id: id, season_number: n, global_status: 'Collect'});
const detail = (id, language) => ({id, genres: [], production_countries: [], original_language: language});
const tick = () => new Promise(resolve => setImmediate(resolve));
const storage = () => {
    const values = new Map();
    return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
};

test('原始语言去除空白并规范大小写，非法和空值标记为未标注，不修改接口数据', () => {
    const input = detail(1, ' ZH ');
    const before = structuredClone(input);
    assert.equal(toMediaMetadata(input).originalLanguage, 'zh');
    assert.deepEqual(input, before);
    for (const value of [null, '', ' ', 'zh-CN', 7, {}, 'eng']) assert.equal(toMediaMetadata(detail(1, value)).originalLanguage, '');
    assert.equal(toMediaMetadata({id: 1}).originalLanguage, undefined);
});

test('语言按电影和季去重，只统计看过，各季共用整剧语言，不按对白语言重复计数', () => {
    const records = [movie(1), movie(1), season(1, 1), season(1, 2), movie(2), movie(3, 'Do')];
    const metadata = {
        'movie-1': toMediaMetadata({...detail(1, 'en'), spoken_languages: [{iso_639_1: 'fr'}]}),
        'tv_season-1': toMediaMetadata(detail(1, 'zh')),
        'movie-2': toMediaMetadata(detail(2, 'en')),
    };
    const before = structuredClone({records, metadata});
    const stats = buildWatchedStats(records, metadata, 'all', 'language');
    assert.equal(stats.total, 4);
    assert.equal(stats.resolved, 4);
    assert.equal(stats.assignments, 4);
    assert.equal(stats.coverageCount, 2);
    assert.deepEqual(stats.rows.map(row => row.key).sort(), ['en', 'zh']);
    const chinese = stats.rows.find(row => row.key === 'zh');
    assert.match(chinese.name, /中文|汉语/);
    assert.equal(chinese.share, 0.5);
    assert.equal(chinese.seasons, 2);
    assert.equal(chinese.movies, 0);
    assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 1);
    assert.equal(buildWatchedStats(records, metadata, 'movie', 'language').rows[0].share, 1);
    assert.equal(buildWatchedStats(records, metadata, 'tv_season', 'language').rows[0].key, 'zh');
    assert.deepEqual({records, metadata}, before);
});

test('缺少语言的旧缓存、未加载和确认未标注分开处理，不把未知语言计入覆盖数', () => {
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, '')),
        'movie-2': toMediaMetadata(detail(2, undefined)),
        'movie-3': toMediaMetadata(detail(3, 'ja')),
    };
    const stats = buildWatchedStats([movie(1), movie(2), movie(3), movie(4)], metadata, 'all', 'language');
    assert.equal(stats.resolved, 2);
    assert.equal(stats.coverageCount, 1);
    assert.equal(stats.rows.find(row => row.key === UNKNOWN_STAT).name, '未标注语言');
    assert.equal(stats.rows.find(row => row.key === 'ja').name, '日语');
    assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 0.5);
    assert.deepEqual(buildWatchedStats([], {}, 'all', 'language').rows, []);
});

test('语言中文名支持本地映射兜底，无需额外请求字典', () => {
    const original = Intl.DisplayNames;
    try {
        Intl.DisplayNames = class { constructor() { throw new Error('unsupported'); } };
        const stats = buildWatchedStats([movie(1)], {'movie-1': toMediaMetadata(detail(1, 'en'))}, 'all', 'language');
        assert.equal(stats.rows[0].name, '英语');
    } finally {
        Intl.DisplayNames = original;
    }
});

test('语言缓存兼容旧数据，持久化后可恢复并拒绝损坏语言字段', () => {
    const disk = storage();
    const value = {...toMediaMetadata(detail(1, 'en')), scores: {}, years: {}};
    disk.setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({version: 1, entries: [
        ['movie-1', value], ['movie-2', {...value, originalLanguage: undefined}],
        ['movie-3', {...value, originalLanguage: ''}],
        ...[null, 12, 'EN', 'zh-CN', {}].map((originalLanguage, i) => [`movie-${i + 4}`, {...value, originalLanguage}]),
    ]}));
    const cache = createMediaMetadataCache(() => disk);
    assert.equal(cache.get('movie-1').originalLanguage, 'en');
    assert.equal(cache.get('movie-2').originalLanguage, undefined);
    assert.equal(cache.get('movie-3').originalLanguage, '');
    for (let i = 4; i <= 8; i++) assert.equal(cache.get(`movie-${i}`), undefined);
    cache.set('movie-9', toMediaMetadata(detail(9, 'ja')));
    cache.flush();
    assert.equal(createMediaMetadataCache(() => disk).get('movie-9').originalLanguage, 'ja');
});

test('新鲜旧缓存缺少语言时仍补全，同剧多季请求一次，语言缺失不反复请求', async () => {
    const disk = storage();
    disk.setItem('gridtrax-progress', '原始观看记录');
    const cache = createMediaMetadataCache(() => disk);
    cache.set('tv_season-1', toMediaMetadata(detail(1, undefined)));
    const calls = [];
    const load = async record => { calls.push(record.tmdb_id); return detail(record.tmdb_id, undefined); };
    const records = [season(1, 1), season(1, 2)];
    const loader = createWatchedGenresLoader(records, {cache, load});
    try {
        loader.start();
        await tick();
        loader.update(records);
        assert.deepEqual(calls, [1]);
        assert.equal(loader.getSnapshot().metadata['tv_season-1'].originalLanguage, '');
        assert.equal(loader.getSnapshot().pendingCount, 0);
    } finally { loader.stop(); }
    const nextLoader = createWatchedGenresLoader(records, {cache, load});
    try {
        nextLoader.start();
        await tick();
        assert.deepEqual(calls, [1]);
        assert.equal(disk.getItem('gridtrax-progress'), '原始观看记录');
    } finally { nextLoader.stop(); }
});

test('统计新增看过记录后补全语言，旧资料不重复请求，删除后移除统计', async () => {
    const cache = createMediaMetadataCache(storage);
    const calls = [];
    const loader = createWatchedGenresLoader([movie(1)], {cache, load: async record => {
        calls.push(record.tmdb_id);
        return detail(record.tmdb_id, record.tmdb_id === 1 ? 'en' : 'zh');
    }});
    try {
        loader.start();
        await tick();
        loader.update([movie(1), movie(2)]);
        await tick();
        assert.deepEqual(calls, [1, 2]);
        assert.equal(buildWatchedStats([movie(1), movie(2)], loader.getSnapshot().metadata, 'all', 'language').coverageCount, 2);
        loader.update([movie(2)]);
        const stats = buildWatchedStats([movie(2)], loader.getSnapshot().metadata, 'all', 'language');
        assert.equal(stats.total, 1);
        assert.equal(stats.rows[0].key, 'zh');
    } finally { loader.stop(); }
});

test('百分格使用最大余数法保证恰好一百格，取整不改变真实数量', () => {
    const counts = [1, 1, 1];
    assert.deepEqual(allocateLanguageCells(counts), [34, 33, 33]);
    assert.deepEqual(counts, [1, 1, 1]);
    assert.deepEqual(allocateLanguageCells([3, 1]), [75, 25]);
    assert.deepEqual(allocateLanguageCells([0, 9, 0]), [0, 100, 0]);
    assert.deepEqual(allocateLanguageCells([]), []);
    assert.deepEqual(allocateLanguageCells([0, -1, NaN, Infinity]), [0, 0, 0, 0]);
});

test('小语种不强行夸大格数，待补全资料保留真实占比，超过百种语言不越界', () => {
    assert.deepEqual(allocateLanguageCells([999, 1]), [100, 0]);
    assert.deepEqual(allocateLanguageCells([1, 1, 2]), [25, 25, 50]);
    const cells = allocateLanguageCells(Array(130).fill(1));
    assert.equal(cells.length, 130);
    assert.equal(cells.reduce((sum, n) => sum + n, 0), 100);
    assert.ok(cells.every(n => n >= 0 && Number.isSafeInteger(n)));
});
