import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGE_NAMES_ZH} from '../src/constants/languageNames.ts';
import {
    DEFAULT_DISCOVERY_FILTERS, DISCOVERY_SORTS, discoveryLanguageLabel, getMovieDiscoveryRequest,
    parseMovieDiscovery, resolveDiscoveryPage, serializeMovieDiscovery, validateMovieDiscovery,
} from '../src/utils/movieDiscovery.ts';

const filters = overrides => ({...DEFAULT_DISCOVERY_FILTERS, genres: [], ...overrides});

test('默认发现查询仅发送基础参数，不暗中限制地区、年份、票数或评分', () => {
    assert.deepEqual(parseMovieDiscovery(new URLSearchParams()), filters());
    assert.deepEqual(getMovieDiscoveryRequest(filters()), {
        path: '/discover/movie', params: {
            language: 'zh-CN', include_adult: false,
            include_video: false, sort_by: 'popularity.desc', page: 1
        },
    });
    assert.equal(serializeMovieDiscovery(filters()).toString(), '');
});

test('组合筛选正确映射日期、任一类型、原始语言和制片地区参数', () => {
    assert.deepEqual(getMovieDiscoveryRequest(filters({
        genres: [18, 28], country: 'CN', language: 'zh',
        yearFrom: '2000', yearTo: '2026', ratingFrom: '7.5', ratingTo: '10', minVotes: '500',
        runtimeFrom: '60', runtimeTo: '180', sort: 'vote_average.desc'
    }), 3), {
        path: '/discover/movie', params: {
            language: 'zh-CN',
            include_adult: false,
            include_video: false,
            sort_by: 'vote_average.desc',
            page: 3,
            with_genres: '18|28',
            with_origin_country: 'CN',
            with_original_language: 'zh',
            'primary_release_date.gte': '2000-01-01',
            'primary_release_date.lte': '2026-12-31',
            'vote_average.gte': 7.5,
            'vote_average.lte': 10,
            'vote_count.gte': 500,
            'with_runtime.gte': 60,
            'with_runtime.lte': 180
        },
    });
});

test('零值仍是有效边界，空值不发送，单侧年份生成正确的日期端点', () => {
    const {params} = getMovieDiscoveryRequest(filters({
        ratingFrom: '0',
        minVotes: '0',
        runtimeTo: '0',
        yearTo: '2020'
    }));
    assert.equal(params['vote_average.gte'], 0);
    assert.equal(params['vote_count.gte'], 0);
    assert.equal(params['with_runtime.lte'], 0);
    assert.equal(params['primary_release_date.lte'], '2020-12-31');
    assert.ok(!('primary_release_date.gte' in params));
    assert.ok(!('region' in params));
});

test('网址往返保留全部条件与页码，多选类型排序去重且不改写表单', () => {
    const original = filters({
        genres: [28, 18, 28], country: 'CN', language: 'en', yearFrom: '1990', yearTo: '2020',
        ratingFrom: '6.5', ratingTo: '9', minVotes: '100', runtimeFrom: '70', runtimeTo: '130', sort: 'revenue.desc'
    });
    const before = structuredClone(original);
    const params = serializeMovieDiscovery(original, 5);
    assert.equal(params.get('page'), '5');
    assert.deepEqual(parseMovieDiscovery(params), {...original, genres: [18, 28]});
    assert.deepEqual(original, before);
    assert.equal(serializeMovieDiscovery(original).has('page'), false);
});

test('地址中的未知字段、非法排序、恶意类型和无效数值不会进入接口参数', () => {
    const parsed = parseMovieDiscovery(new URLSearchParams({
        sort: '__proto__', country: 'china', language: 'en-US',
        genres: '18,-5,nope,1.5,28,18,9007199254740992', yearFrom: '1e3', yearTo: '9999', ratingFrom: '-1',
        ratingTo: 'NaN', runtimeFrom: 'Infinity', minVotes: '2.5', api_key: 'do-not-forward', include_adult: 'true'
    }));
    assert.deepEqual(parsed, filters({genres: [18, 28]}));
    assert.ok(!('api_key' in getMovieDiscoveryRequest(parsed).params));
    assert.equal(getMovieDiscoveryRequest(parsed).params.include_adult, false);
});

test('手工网址中的倒置范围被丢弃，其他有效字段保持不变', () => {
    const parsed = parseMovieDiscovery(new URLSearchParams({
        yearFrom: '2020', yearTo: '1990', ratingFrom: '9', ratingTo: '2',
        runtimeFrom: '150', runtimeTo: '60', country: 'cn', minVotes: '00100'
    }));
    assert.deepEqual(parsed, filters({country: 'CN', minVotes: '100'}));
});

test('草稿的倒置范围逐项提示，原始输入不被静默交换', () => {
    const draft = filters({
        yearFrom: '2020',
        yearTo: '1990',
        ratingFrom: '9',
        ratingTo: '8',
        runtimeFrom: '120',
        runtimeTo: '60'
    });
    const before = structuredClone(draft);
    assert.deepEqual(validateMovieDiscovery(draft), {yearTo: '不能小于起始值', ratingTo: '不能小于起始值', runtimeTo: '不能小于起始值'});
    assert.deepEqual(draft, before);
});

test('表单限制整数年份、票数和片长，接受合法评分小数及等值范围', () => {
    const errors = validateMovieDiscovery(filters({
        yearFrom: '2020.5',
        minVotes: '-1',
        runtimeFrom: '5.5',
        ratingFrom: '11'
    }));
    for (const field of ['yearFrom', 'minVotes', 'runtimeFrom', 'ratingFrom']) assert.ok(errors[field]);
    assert.deepEqual(validateMovieDiscovery(filters({
        yearFrom: '2000', yearTo: '2000', ratingFrom: '8.1', ratingTo: '8.1',
        minVotes: '0', runtimeFrom: '60', runtimeTo: '60'
    })), {});
});

test('所有排序选项均能持久化并正确发送', () => {
    for (const {value} of DISCOVERY_SORTS) {
        const parsed = parseMovieDiscovery(serializeMovieDiscovery(filters({sort: value})));
        assert.equal(parsed.sort, value);
        assert.equal(getMovieDiscoveryRequest(parsed).params.sort_by, value);
    }
});

test('页码限制为前500页，不接受零、负数、小数和非数字', () => {
    for (const value of [null, '', '0', '-1', '2.5', 'Infinity', 'NaN']) assert.equal(resolveDiscoveryPage(value), 1);
    assert.equal(resolveDiscoveryPage('5000'), 500);
    assert.equal(resolveDiscoveryPage('2'), 2);
    assert.equal(getMovieDiscoveryRequest(filters(), -5).params.page, 1);
});

test('语言名称使用中文且非法代码有兜底', () => {
    assert.match(discoveryLanguageLabel('zh'), /中文/);
    assert.match(discoveryLanguageLabel('en'), /英语/);
    assert.equal(discoveryLanguageLabel('invalid_language', '未知语言'), '未知语言');
});

test('中文映射表包含提供的187项语言，每项均为两位代码和中文名称', () => {
    assert.equal(Object.keys(LANGUAGE_NAMES_ZH).length, 187);
    assert.ok(Object.isFrozen(LANGUAGE_NAMES_ZH));
    for (const [code, label] of Object.entries(LANGUAGE_NAMES_ZH)) {
        assert.match(code, /^[a-z]{2}$/);
        assert.match(label, /\p{Script=Han}/u);
    }
    assert.equal(LANGUAGE_NAMES_ZH.cn, '粤语');
    assert.equal(LANGUAGE_NAMES_ZH.xx, '无语言');
});

test('浏览器中文名称优先于本地映射和接口名称', context => {
    context.mock.method(Intl.DisplayNames.prototype, 'of', () => '浏览器中文名称');
    assert.equal(discoveryLanguageLabel('en', 'English'), '浏览器中文名称');
});

test('浏览器不识别或缺少中文数据时使用本地映射', context => {
    const lookup = context.mock.method(Intl.DisplayNames.prototype, 'of', code => code);
    assert.equal(discoveryLanguageLabel('cn', 'Cantonese'), '粤语');
    assert.equal(discoveryLanguageLabel('xx', 'No Language'), '无语言');
    lookup.mock.mockImplementation(() => undefined);
    assert.equal(discoveryLanguageLabel('ja', 'Japanese'), '日语');
    lookup.mock.mockImplementation(() => 'English');
    assert.equal(discoveryLanguageLabel('en', 'English'), '英语');
});

test('浏览器功能不可用时全部187项仍可显示中文且筛选代码不变', context => {
    context.mock.method(Intl, 'DisplayNames', function () { throw new Error('不可用'); });
    for (const [code, label] of Object.entries(LANGUAGE_NAMES_ZH)) {
        assert.equal(discoveryLanguageLabel(code, 'API name'), label);
    }
    assert.equal(getMovieDiscoveryRequest(filters({language: 'cn'})).params.with_original_language, 'cn');
    assert.equal(getMovieDiscoveryRequest(filters({language: 'xx'})).params.with_original_language, 'xx');
});

test('未收录语言回退到接口名称或代码，不误读对象原型属性', context => {
    context.mock.method(Intl.DisplayNames.prototype, 'of', code => code);
    assert.equal(discoveryLanguageLabel('zz', '  接口名称  '), '接口名称');
    assert.equal(discoveryLanguageLabel('zz', '  '), 'zz');
    assert.equal(discoveryLanguageLabel('zz'), 'zz');
    assert.equal(discoveryLanguageLabel('constructor'), 'constructor');
});
