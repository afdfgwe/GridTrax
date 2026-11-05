import assert from 'node:assert/strict';
import test from 'node:test';
import {buildWatchedStats} from '../src/utils/stats/watchedStats.ts';
import {buildWatchedGenreStats} from '../src/utils/stats/watchedGenres.ts';
import {createWatchedGenresLoader} from '../src/utils/stats/watchedGenresLoader.ts';
import {
    createMediaMetadataCache,
    MEDIA_METADATA_STORAGE_KEY,
    toMediaMetadata
} from '../src/utils/media/mediaMetadataCache.ts';

const movie = (id, status = 'Collect') => ({
    type: 'movie',
    tmdb_id: id,
    global_status: status,
    last_interacted: 1793577600000
});
const season = (id, number) => ({type: 'tv_season', tmdb_id: id, season_number: number, global_status: 'Collect'});
const cn = {iso_3166_1: 'CN', name: 'China'};
const us = {iso_3166_1: 'US', name: 'United States of America'};
const detail = (id, countries = [cn], release_date = '2024-01-01') => ({
    id,
    genres: [{id: 18, name: '剧情'}],
    production_countries: countries,
    release_date
});
const dictionary = [{iso_3166_1: 'CN', english_name: 'China', native_name: '中国大陆'}];
const storage = () => {
    const data = new Map();
    return {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
        removeItem: key => data.delete(key)
    };
};

test('制片地区规范化、去重、忽略非法代码，不修改接口原值', () => {
    const response = detail(1, [cn, {iso_3166_1: ' cn ', name: ' China '}, us, {iso_3166_1: 'bad', name: 'bad'}, null]);
    const original = structuredClone(response);
    assert.deepEqual(toMediaMetadata(response).countries, [cn, us]);
    assert.deepEqual(response, original);
    assert.deepEqual(toMediaMetadata(detail(1, null)).countries, []);
    assert.equal(toMediaMetadata({id: 1}).countries, undefined);
});

test('合拍作品分别计数，环形图按归属次数计算占比；优先使用中文字典', () => {
    const records = [movie(1), movie(2), season(3, 1), season(3, 2), movie(4, 'Wish')];
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, [cn, us, cn])),
        'movie-2': toMediaMetadata(detail(2, [us])),
        'tv_season-3': toMediaMetadata(detail(3, [cn])),
    };
    const before = structuredClone({records, metadata});
    const stats = buildWatchedStats(records, metadata, 'all', 'country', dictionary);
    assert.equal(stats.total, 4);
    assert.equal(stats.resolved, 4);
    assert.equal(stats.assignments, 5);
    assert.equal(stats.coverageCount, 2);
    assert.equal(stats.rows[0].name, '中国大陆');
    assert.equal(stats.rows[0].share, 3 / 5);
    assert.equal(stats.rows[0].movies, 1);
    assert.equal(stats.rows[0].seasons, 2);
    assert.equal(stats.rows[1].name, '美国');
    assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 1);
    assert.deepEqual({records, metadata}, before);
});

test('无制片地区、缺少字段的旧缓存与尚未加载分开处理，不使用电视剧 origin_country', () => {
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, [])),
        'movie-2': toMediaMetadata({id: 2, genres: []}),
        'tv_season-4': toMediaMetadata({...detail(4, []), origin_country: ['CN']}),
    };
    const stats = buildWatchedStats([movie(1), movie(2), movie(3), season(4, 1)], metadata, 'all', 'country');
    assert.equal(stats.resolved, 2);
    assert.equal(stats.assignments, 0);
    assert.equal(stats.coverageCount, 0);
    assert.equal(stats.total, 0);
    assert.equal(stats.sourceTotal, 4);
    assert.deepEqual(stats.rows, []);
    assert.deepEqual(stats.records, []);
});

test('各季使用自身首播年份；不回退到整剧首播或标记时间，缺失年份不参与统计', () => {
    const records = [movie(1), movie(2), season(3, 1), season(3, 2), season(3, 3), movie(4)];
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, [], '2024-12-31')),
        'movie-2': toMediaMetadata(detail(2, [], '')),
        'tv_season-3': toMediaMetadata({
            id: 3, first_air_date: '1999-01-01', seasons: [
                {season_number: 1, air_date: '2020-01-01'},
                {season_number: 2, air_date: '2024-01-01'},
                {season_number: 3, air_date: null},
            ]
        }),
    };
    const stats = buildWatchedStats(records, metadata, 'all', 'year');
    assert.equal(stats.resolved, 5);
    assert.equal(stats.coverageCount, 2);
    assert.deepEqual(stats.rows.map(row => [row.key, row.records.length]), [['2020', 1], ['2024', 2]]);
    assert.equal(stats.total, 3);
    assert.equal(stats.sourceTotal, 6);
    assert.equal(stats.movies, 1);
    assert.equal(stats.seasons, 2);
    assert.equal(stats.shows, 1);
    assert.equal(stats.rows[1].movies, 1);
    assert.equal(stats.rows[1].seasons, 1);
    assert.equal(stats.rows[1].share, 2 / 3);
    assert.ok(!stats.rows.some(row => ['1999', '2026'].includes(row.key)));
});

test('电影与电视剧筛选、同 ID 媒体区分、重复记录与空记录均正确', () => {
    const records = [movie(1), movie(1), season(1, 1), season(1, 2)];
    const metadata = {
        'movie-1': toMediaMetadata(detail(1, [us])),
        'tv_season-1': toMediaMetadata({
            id: 1,
            production_countries: [cn],
            seasons: [{season_number: 1, air_date: '2020-01-01'}, {season_number: 2, air_date: '2021-01-01'}]
        })
    };
    const movies = buildWatchedStats(records, metadata, 'movie', 'country');
    assert.equal(movies.total, 1);
    assert.equal(movies.rows[0].key, 'US');
    const series = buildWatchedStats(records, metadata, 'tv_season', 'year');
    assert.equal(series.total, 2);
    assert.deepEqual(series.rows.map(row => row.key), ['2020', '2021']);
    for (const dimension of ['genre', 'country', 'year', 'language']) {
        const stats = buildWatchedStats([], {}, 'all', dimension);
        assert.equal(stats.total, 0);
        assert.equal(stats.sourceTotal, 0);
        assert.equal(stats.assignments, 0);
        assert.equal(stats.coverageCount, 0);
        assert.deepEqual(stats.rows, []);
    }
});

test('四个维度独立排除未标注记录，列表、总数和占比分母只保留当前维度有值的作品', () => {
    const records = [movie(1), movie(2), movie(3), movie(4), movie(5), movie(1), movie(6, 'Wish')];
    const metadata = {
        'movie-1': toMediaMetadata({...detail(1), spoken_languages: [{iso_639_1: 'zh', name: '普通话'}]}),
        'movie-2': toMediaMetadata({...detail(2, [us]), genres: []}),
        'movie-3': toMediaMetadata({...detail(3, [], ''), spoken_languages: [{iso_639_1: 'en', name: 'English'}]}),
        'movie-4': toMediaMetadata({...detail(4, [], ''), genres: [], spoken_languages: []}),
    };
    const before = structuredClone({records, metadata});
    const expected = {genre: [1, 3], country: [1, 2], year: [1, 2], language: [1, 3]};
    for (const dimension of Object.keys(expected)) {
        const stats = buildWatchedStats(records, metadata, 'all', dimension);
        assert.equal(stats.total, 2);
        assert.equal(stats.sourceTotal, 5);
        assert.equal(stats.movies, 2);
        assert.equal(stats.seasons, 0);
        assert.equal(stats.shows, 0);
        assert.deepEqual(stats.records.map(record => record.tmdb_id).sort(), expected[dimension]);
        assert.ok(stats.rows.every(row => row.key !== 'unknown' && !row.name.startsWith('未标注')));
        assert.equal(stats.rows.reduce((sum, row) => sum + row.share, 0), 1);
    }
    assert.deepEqual({records, metadata}, before);
});

test('四个维度全部未标注时总数、归属次数、覆盖和列表均为空，不制造未知分组', () => {
    const records = [movie(1), season(2, 1), season(2, 2)];
    const empty = id => toMediaMetadata({id, genres: [], production_countries: [], spoken_languages: [], seasons: []});
    const metadata = {'movie-1': empty(1), 'tv_season-2': empty(2)};
    for (const dimension of ['genre', 'country', 'year', 'language']) {
        for (const kind of ['all', 'movie', 'tv_season']) {
            const stats = buildWatchedStats(records, metadata, kind, dimension);
            assert.equal(stats.total, 0);
            assert.equal(stats.movies, 0);
            assert.equal(stats.seasons, 0);
            assert.equal(stats.shows, 0);
            assert.equal(stats.assignments, 0);
            assert.equal(stats.coverageCount, 0);
            assert.deepEqual(stats.rows, []);
            assert.deepEqual(stats.records, []);
        }
    }
});

test('扩展统计维度不改变原有类型计数和分母', () => {
    const records = [movie(1), season(2, 1), movie(3)];
    const metadata = {'movie-1': toMediaMetadata(detail(1)), 'tv_season-2': toMediaMetadata(detail(2))};
    const original = buildWatchedGenreStats(records, metadata);
    const extended = buildWatchedStats(records, metadata);
    assert.deepEqual(extended.rows, original.rows);
    assert.equal(extended.resolved, original.resolved);
    assert.equal(extended.coverageCount, original.genreCount);
});

test('旧缓存缺少地区时即使类型未过期仍补全，同剧多季只请求一次', async () => {
    const cache = createMediaMetadataCache(storage);
    cache.set('tv_season-1', toMediaMetadata({id: 1, genres: [{id: 18, name: '剧情'}], seasons: []}));
    const calls = [];
    const loader = createWatchedGenresLoader([season(1, 1), season(1, 2)], {
        cache, load: async record => {
            calls.push(record.tmdb_id);
            return {...detail(1), seasons: [{season_number: 1, air_date: '2020-01-01'}]};
        }
    });
    try {
        loader.start();
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls, [1]);
        assert.deepEqual(loader.getSnapshot().metadata['tv_season-1'].countries, [cn]);
        assert.equal(loader.getSnapshot().pendingCount, 0);
    } finally {
        loader.stop();
    }
});

test('地区缓存兼容旧数据并拒绝损坏条目', () => {
    const disk = storage();
    const cached = toMediaMetadata(detail(1));
    disk.setItem(MEDIA_METADATA_STORAGE_KEY, JSON.stringify({
        version: 1, entries: [
            ['movie-1', cached], ['movie-2', {
                ...cached,
                scores: {},
                years: {},
                countries: [{iso_3166_1: 'CN', name: 1}]
            }],
            ['movie-3', {...cached, scores: {}, years: {}, countries: [null]}],
            ['movie-4', {...cached, scores: {}, years: {}, countries: [{iso_3166_1: 'USA', name: '美国'}]}],
            ['movie-5', {...cached, countries: undefined, scores: {}, years: {}}],
        ]
    }));
    const cache = createMediaMetadataCache(() => disk);
    assert.deepEqual(cache.get('movie-1').countries, [cn]);
    for (const id of [2, 3, 4]) assert.equal(cache.get(`movie-${id}`), undefined);
    assert.equal(cache.get('movie-5').countries, undefined);
});
