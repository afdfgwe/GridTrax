import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_DISCOVERY_FILTERS, getDiscoverySortGroups, getDiscoverySorts,
    getMovieDiscoveryRequest, getTVDiscoveryRequest, parseMovieDiscovery,
    resolveDiscoveryKind, serializeMovieDiscovery,
} from '../src/utils/movieDiscovery.ts';

const filters = overrides => ({...DEFAULT_DISCOVERY_FILTERS, genres: [], ...overrides});

test('筛选类别默认电影，仅 tv 参数启用电视剧', () => {
    for (const value of [null, '', 'movie', 'person', 'TV', '__proto__']) {
        assert.equal(resolveDiscoveryKind(value), 'movie');
    }
    assert.equal(resolveDiscoveryKind('tv'), 'tv');
    assert.equal(serializeMovieDiscovery(filters()).toString(), '');
    assert.equal(serializeMovieDiscovery(filters(), 1, 'tv').toString(), 'kind=tv');
});

test('电视剧默认查询使用独立接口和北京时间，不发送电影专属参数', () => {
    assert.deepEqual(getTVDiscoveryRequest(filters()), {
        path: '/discover/tv',
        params: {
            language: 'zh-CN', include_adult: false, timezone: 'Asia/Shanghai',
            sort_by: 'popularity.desc', page: 1,
        },
    });
    assert.notEqual(getTVDiscoveryRequest(filters()).path, getMovieDiscoveryRequest(filters()).path);
});

test('电视剧组合筛选使用整剧首播日期与单集时长', () => {
    const original = filters({
        genres: [18, 10759], country: 'CN', language: 'zh', yearFrom: '2004', yearTo: '2026',
        ratingFrom: '7', ratingTo: '9', minVotes: '250', runtimeFrom: '32', runtimeTo: '64',
        sort: 'first_air_date.desc',
    });
    const before = structuredClone(original);
    assert.deepEqual(getTVDiscoveryRequest(original, 3), {
        path: '/discover/tv',
        params: {
            language: 'zh-CN', include_adult: false, timezone: 'Asia/Shanghai',
            sort_by: 'first_air_date.desc', page: 3,
            with_genres: '18|10759', with_origin_country: 'CN', with_original_language: 'zh',
            'first_air_date.gte': '2004-01-01', 'first_air_date.lte': '2026-12-31',
            'vote_average.gte': 7, 'vote_average.lte': 9, 'vote_count.gte': 250,
            'with_runtime.gte': 32, 'with_runtime.lte': 64,
        },
    });
    assert.deepEqual(original, before);
});

test('电视剧排序按五个字段分组，每组支持升降序且不包含电影或原始标题排序', () => {
    const fields = ['popularity', 'vote_average', 'first_air_date', 'vote_count', 'name'];
    assert.deepEqual(getDiscoverySortGroups('tv').map(group => group.value), fields);
    assert.deepEqual(getDiscoverySorts('tv').map(option => option.value).sort(),
        fields.flatMap(field => [`${field}.asc`, `${field}.desc`]).sort());
    assert.equal(getDiscoverySortGroups('movie').length, 6);
    assert.equal(getDiscoverySorts('movie').length, 12);
});

test('每个电视剧排序都能通过网址恢复并发送到接口', () => {
    for (const {value} of getDiscoverySorts('tv')) {
        const params = serializeMovieDiscovery(filters({sort: value}), 2, 'tv');
        const restored = parseMovieDiscovery(params, resolveDiscoveryKind(params.get('kind')));
        assert.equal(restored.sort, value);
        assert.equal(params.get('kind'), 'tv');
        assert.equal(getTVDiscoveryRequest(restored, Number(params.get('page'))).params.sort_by, value);
    }
});

test('电影专属排序不进入电视剧请求，电视剧专属排序不进入电影请求', () => {
    for (const sort of ['revenue.asc', 'title.desc', 'primary_release_date.desc', 'unknown']) {
        assert.equal(parseMovieDiscovery(new URLSearchParams({sort}), 'tv').sort, 'popularity.desc');
        assert.equal(getTVDiscoveryRequest(filters({sort})).params.sort_by, 'popularity.desc');
    }
    for (const sort of ['name.asc', 'first_air_date.desc']) {
        assert.equal(parseMovieDiscovery(new URLSearchParams({sort})).sort, 'popularity.desc');
        assert.equal(getMovieDiscoveryRequest(filters({sort})).params.sort_by, 'popularity.desc');
    }
});

test('电视剧网址往返保留类别、条件和页码，不修改原始表单', () => {
    const original = filters({
        genres: [10759, 18, 10759], country: 'CN', language: 'zh', yearFrom: '2000', yearTo: '2026',
        ratingFrom: '6', ratingTo: '9', minVotes: '100', runtimeFrom: '16', runtimeTo: '96', sort: 'name.asc',
    });
    const before = structuredClone(original);
    const params = serializeMovieDiscovery(original, 5, 'tv');
    assert.equal(params.get('kind'), 'tv');
    assert.equal(params.get('page'), '5');
    assert.deepEqual(parseMovieDiscovery(params, 'tv'), {...original, genres: [18, 10759]});
    assert.deepEqual(original, before);
    assert.equal(serializeMovieDiscovery(filters(), 1, 'tv').has('page'), false);
});

test('电视剧零值边界有效，页码限制及单侧首播年份与电影一致', () => {
    const {params} = getTVDiscoveryRequest(filters({
        ratingFrom: '0',
        minVotes: '0',
        runtimeTo: '0',
        yearTo: '2020'
    }), 501);
    assert.equal(params['vote_average.gte'], 0);
    assert.equal(params['vote_count.gte'], 0);
    assert.equal(params['with_runtime.lte'], 0);
    assert.equal(params['first_air_date.lte'], '2020-12-31');
    assert.ok(!('first_air_date.gte' in params));
    assert.ok(!('primary_release_date.lte' in params));
    assert.ok(!('include_video' in params));
    assert.equal(params.page, 500);
    assert.equal(getTVDiscoveryRequest(filters(), -1).params.page, 1);
});
