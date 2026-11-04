import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedStats, UNKNOWN_STAT} from '../src/utils/stats/watchedStats.ts';
import {createWatchedGenresLoader} from '../src/utils/stats/watchedGenresLoader.ts';
import {createMediaMetadataCache, MEDIA_METADATA_STORAGE_KEY, toMediaMetadata} from '../src/utils/media/mediaMetadataCache.ts';

const movie = (id, status = 'Collect') => ({type: 'movie', tmdb_id: id, global_status: status});
const season = (id, n) => ({type: 'tv_season', tmdb_id: id, season_number: n, global_status: 'Collect'});
const language = (code, name = '', english_name = '') => ({iso_639_1: code, name, english_name});
const detail = (id, languages) => ({id, genres: [], production_countries: [], ...(languages === undefined ? {} : {spoken_languages: languages})});
const tick = () => new Promise(resolve => setImmediate(resolve));
const storage = () => {
    const values = new Map();
    return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
};

test('对白语言规范代码、去重并剔除非法数据，不修改接口原始值', () => {
    const input = detail(1, [language(' ZH ', ' 普通话 '), language('zh', '普通话'), language('en'), null,
        language(''), language('zh-CN'), language('eng'), language(7)]);
    const before = structuredClone(input);
    assert.deepEqual(toMediaMetadata(input).spokenLanguages, [language('zh', '普通话'), language('en')]);
    assert.deepEqual(input, before);
    for (const value of [null, '', 7, {}]) assert.deepEqual(toMediaMetadata(detail(1, value)).spokenLanguages, []);
    assert.equal(toMediaMetadata({id: 1, original_language: 'zh'}).spokenLanguages, undefined);
});

test('多种对白语言分别计数，电影和季去重，各季继承整剧语言且忽略原始语言', () => {
    const records = [movie(1), movie(1), season(1, 1), season(1, 2), movie(2), movie(3, 'Do')];
    const metadata = {
        'movie-1': toMediaMetadata({...detail(1, [language('en'), language('fr')]), original_language: 'ja'}),
        'tv_season-1': toMediaMetadata(detail(1, [language('zh', '普通话'), language('en')])),
        'movie-2': toMediaMetadata(detail(2, [language('en')])),
    };
    const before = structuredClone({records, metadata});
    const stats = buildWatchedStats(records, metadata, 'all', 'language');
    assert.equal(stats.total, 4);
    assert.equal(stats.resolved, 4);
    assert.equal(stats.assignments, 7);
    assert.equal(stats.coverageCount, 3);
    assert.deepEqual(stats.rows.map(row => row.key).sort(), ['en', 'fr', 'zh']);
    const chinese = stats.rows.find(row => row.key === 'zh');
    assert.equal(chinese.name, '普通话');
    assert.equal(chinese.share, 0.5);
    assert.equal(chinese.seasons, 2);
    assert.equal(chinese.movies, 0);
    assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 1.75);
    assert.equal(buildWatchedStats(records, metadata, 'movie', 'language').rows[0].share, 1);
    assert.equal(buildWatchedStats(records, metadata, 'tv_season', 'language').assignments, 4);
    assert.deepEqual({records, metadata}, before);
});

test('旧缓存、未加载和确认未标注分别处理，不把未知语言计入覆盖数', () => {
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, [])),
        'movie-2': toMediaMetadata(detail(2, undefined)),
        'movie-3': toMediaMetadata(detail(3, [language('ja')])),
    };
    const stats = buildWatchedStats([movie(1), movie(2), movie(3), movie(4)], metadata, 'all', 'language');
    assert.equal(stats.resolved, 2);
    assert.equal(stats.coverageCount, 1);
    assert.equal(stats.rows.find(row => row.key === UNKNOWN_STAT).name, '未标注语言');
    assert.equal(stats.rows.find(row => row.key === 'ja').name, '日语');
    assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 0.5);
    assert.deepEqual(buildWatchedStats([], {}, 'all', 'language').rows, []);
});

test('中文对白名称优先使用接口，其他名称可用本地映射兜底', () => {
    const original = Intl.DisplayNames;
    try {
        Intl.DisplayNames = class { constructor() { throw new Error('unsupported'); } };
        const stats = buildWatchedStats([movie(1)], {'movie-1': toMediaMetadata(detail(1,
            [language('en', 'English'), language('zh', '普通话')]))}, 'all', 'language');
        assert.equal(stats.rows.find(row => row.key === 'en').name, '英语');
        assert.equal(stats.rows.find(row => row.key === 'zh').name, '普通话');
    } finally { Intl.DisplayNames = original; }
});

test('语言缓存兼容旧字段，持久化后可恢复并拒绝损坏的对白语言数组', () => {
    const disk = storage();
    const value = {...toMediaMetadata(detail(1, [language('en')])), scores: {}, years: {}};
    disk.setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({version: 1, entries: [
        ['movie-1', value], ['movie-2', {...value, spokenLanguages: undefined, originalLanguage: 'zh'}],
        ['movie-3', {...value, spokenLanguages: []}],
        ...[null, 12, 'en', {}, [null], [language('EN')], [language('zh-CN')], [{iso_639_1:'en'}]]
            .map((spokenLanguages, i) => ['movie-' + (i + 4), {...value, spokenLanguages}]),
    ]}));
    const cache = createMediaMetadataCache(() => disk);
    assert.deepEqual(cache.get('movie-1').spokenLanguages, [language('en')]);
    assert.equal(cache.get('movie-2').spokenLanguages, undefined);
    assert.deepEqual(cache.get('movie-3').spokenLanguages, []);
    for (let i = 4; i <= 11; i++) assert.equal(cache.get('movie-' + i), undefined);
    cache.set('movie-12', toMediaMetadata(detail(12, [language('ja')])));
    cache.flush();
    assert.deepEqual(createMediaMetadataCache(() => disk).get('movie-12').spokenLanguages, [language('ja')]);
});

test('新鲜原始语言缓存也补全对白语言，同剧多季只请求一次，空值不反复请求', async () => {
    const disk = storage();
    disk.setItem('gridtrax-progress', '原始观看记录');
    const cache = createMediaMetadataCache(() => disk);
    cache.set('tv_season-1', {...toMediaMetadata(detail(1, undefined)), originalLanguage: 'zh'});
    const calls = [];
    const load = async record => { calls.push(record.tmdb_id); return detail(record.tmdb_id, undefined); };
    const records = [season(1, 1), season(1, 2)];
    const loader = createWatchedGenresLoader(records, {cache, load});
    try {
        loader.start();
        await tick();
        loader.update(records);
        assert.deepEqual(calls, [1]);
        assert.deepEqual(loader.getSnapshot().metadata['tv_season-1'].spokenLanguages, []);
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
        return detail(record.tmdb_id, [language(record.tmdb_id === 1 ? 'en' : 'zh')]);
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

test('手动传入含重复语言的资料也只按一部作品计数', () => {
    const metadata = toMediaMetadata(detail(1, [language('en')]));
    metadata.spokenLanguages.push(language('en'));
    const stats = buildWatchedStats([movie(1)], {'movie-1': metadata}, 'all', 'language');
    assert.equal(stats.assignments, 1);
    assert.equal(stats.rows[0].records.length, 1);
    assert.equal(stats.rows[0].share, 1);
});

test('只有未标注语言时保留筛选分组，不虚增语言覆盖数量', () => {
    const stats = buildWatchedStats([movie(1), season(2, 1)], {
        'movie-1': toMediaMetadata(detail(1, [])),
        'tv_season-2': toMediaMetadata(detail(2, [])),
    }, 'all', 'language');
    assert.equal(stats.coverageCount, 0);
    assert.equal(stats.assignments, 2);
    assert.equal(stats.rows.length, 1);
    assert.equal(stats.rows[0].key, UNKNOWN_STAT);
    assert.equal(stats.rows[0].movies, 1);
    assert.equal(stats.rows[0].seasons, 1);
});
