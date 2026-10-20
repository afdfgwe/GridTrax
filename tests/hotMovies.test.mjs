import test from 'node:test';
import assert from 'node:assert/strict';
import {createHotHandler, createHotMoviesHandler, parseHotItems, parseHotMovies} from '../server/hotMovies.ts';
import {matchHotMovie, normalizeMovieTitle, resolveHotMovie} from '../src/utils/hotMovieMatch.ts';
import {parseHotMovieInfo} from '../src/utils/hotMovieInfo.ts';

test('榜单 info 按地区、类型、导演和演员分组，缺项不占位置', () => {
    assert.deepEqual(parseHotMovieInfo('中国大陆 / 剧情 爱情 古装 / 杨龙 / 田曦薇 闫桉'), [
        {label: '地区', value: '中国大陆'},
        {label: '类型', value: '剧情 爱情 古装'},
        {label: '导演', value: '杨龙'},
        {label: '演员', value: '田曦薇 闫桉'},
    ]);
    assert.deepEqual(parseHotMovieInfo('美国 / 科幻 / / 演员甲 / 演员乙'), [
        {label: '地区', value: '美国'},
        {label: '类型', value: '科幻'},
        {label: '演员', value: '演员甲 · 演员乙'},
    ]);
    assert.deepEqual(parseHotMovieInfo(' /  /  '), []);
    assert.deepEqual(parseHotMovieInfo(), []);
});

const rawMovie = (overrides = {}) => ({
    id: '123', title: '测试电影', type: 'movie', year: '2026', rank: 1,
    score: 99999, rating: {value: 7.3}, ...overrides
});
const rawTV = (overrides = {}) => ({
    id: '456', title: '测试剧集', type: 'tv', year: '2026', rank: 1,
    score: 99999, rating: {value: 0}, ...overrides
});
const source = (...items) => ({subject_collection_items: items});
const request = () => new Request('https://example.com/api/hot/movies');
const item = {id: '123', title: '测试电影', year: '2026'};
const movie = (overrides = {}) => ({id: 1, title: '测试电影', release_date: '2026-01-01', ...overrides});

test('只提取榜单所需字段，评分用 rating.value，不带出评论和用户信息', () => {
    const data = source(rawMovie({
        title: '测试电影\u200e',
        original_title: 'Test Movie',
        info: ' 中国大陆 / 剧情\u200e / 主演 ',
        comments: ['private'],
        user: {id: 99}
    }));
    const before = structuredClone(data);
    assert.deepEqual(parseHotMovies(data), [{
        id: '123',
        rank: 1,
        title: '测试电影',
        originalTitle: 'Test Movie',
        year: '2026',
        info: '中国大陆 / 剧情 / 主演',
        rating: 7.3
    }]);
    assert.deepEqual(data, before);
});

test('最多保留十部电影，维持排名、过滤无效 ID 和重复条目', () => {
    const values = Array.from({length: 12}, (_, index) => rawMovie({id: String(index + 1), rank: index + 1}));
    assert.equal(parseHotMovies(source(...values)).length, 10);
    assert.deepEqual(parseHotMovies(source(rawMovie({id: '2', rank: 2}), rawMovie())).map(v => v.rank), [1, 2]);
    assert.equal(parseHotMovies(source(rawMovie(), rawMovie(), rawMovie({id: '../bad'}), rawMovie({
        id: '5',
        type: 'tv'
    }))).length, 1);
});

test('无评分、无年份和格式错误的响应不伪造资料', () => {
    for (const value of [0, null, undefined, -1, 11, '7.3', NaN]) {
        const [parsed] = parseHotMovies(source(rawMovie({year: '待定', info: 123, rating: {value}})));
        assert.equal(parsed.rating, undefined);
        assert.equal(parsed.year, undefined);
        assert.equal(parsed.info, undefined);
    }
    for (const data of [null, {}, {subject_collection_items: []}, source({id: 1})]) {
        assert.throws(() => parseHotMovies(data));
    }
});

test('电视剧只取榜单字段，忽略电影、热度及无评分的零值', () => {
    const data = source(rawTV({
        original_title: 'Test Show',
        info: '中国大陆 / 剧情',
        comments: [{user: {id: 42}}]
    }), rawMovie());
    assert.deepEqual(parseHotItems(data, 'tv'), [{
        id: '456', rank: 1, title: '测试剧集',
        originalTitle: 'Test Show', year: '2026', info: '中国大陆 / 剧情', rating: undefined
    }]);
    assert.equal(parseHotItems(source(rawMovie(), rawTV()), 'movie').length, 1);
    assert.throws(() => parseHotItems(source(rawMovie()), 'tv'));
});

test('电视剧匹配使用首播年份，拒绝错年或有歧义的同名剧集', () => {
    const show = {id: 2, title: '测试剧集', release_date: '2026-01-01', vote_average: 8.2};
    const subject = {id: '456', title: '测试剧集', year: '2026'};
    assert.equal(matchHotMovie(subject, [show])?.vote_average, 8.2);
    assert.equal(matchHotMovie(subject, [{...show, release_date: '2019-01-01'}]), undefined);
    assert.equal(matchHotMovie(subject, [show, {...show, id: 3}]), undefined);
});

test('同名电影优先同年，保留数字区别续集，候选有歧义时不链接', () => {
    assert.equal(matchHotMovie(item, [movie({id: 2, release_date: '2000-01-01'}), movie()])?.id, 1);
    assert.equal(matchHotMovie(item, [movie(), movie({id: 2})]), undefined);
    assert.equal(matchHotMovie(item, [movie({title: '测试电影2'})]), undefined);
    assert.equal(matchHotMovie(item, [movie({release_date: ''})]), undefined);
    assert.equal(matchHotMovie(item, [movie({release_date: '2000-01-01'})]), undefined);
    assert.equal(matchHotMovie(item, [movie(), movie()])?.id, 1);
    assert.equal(normalizeMovieTitle(' Ｔｅｓｔ：Movie\u200e '), 'testmovie');
});

test('跨地区年份相差一年仅接受唯一同名候选，豆瓣无年份也不猜测多候选', () => {
    assert.equal(matchHotMovie(item, [movie({release_date: '2025-05-05'})])?.id, 1);
    assert.equal(matchHotMovie(item, [movie({release_date: '2025-05-05'}), movie({
        id: 2,
        release_date: '2027-01-01'
    })]), undefined);
    assert.equal(matchHotMovie({...item, year: undefined}, [movie()])?.id, 1);
    assert.equal(matchHotMovie({...item, year: undefined}, [movie(), movie({id: 2})]), undefined);
});

test('中文搜索未命中后可用原名搜索，匹配后不额外请求详情', async () => {
    const queries = [];
    const result = await resolveHotMovie({...item, originalTitle: 'Test Movie'}, async query => {
        queries.push(query);
        return query === 'Test Movie' ? [movie({title: '另一译名', original_title: 'Test Movie'})] : [];
    }, new AbortController().signal);
    assert.equal(result.id, 1);
    assert.deepEqual(queries, ['测试电影', 'Test Movie']);
    let calls = 0;
    await resolveHotMovie({...item, originalTitle: 'Test Movie'}, async () => {
        calls++;
        return [movie()];
    }, new AbortController().signal);
    assert.equal(calls, 1);
});

test('取消后不发起后续匹配请求', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(resolveHotMovie({...item, originalTitle: 'Test Movie'}, async () => {
        calls++;
        controller.abort();
        return [];
    }, controller.signal), {name: 'AbortError'});
    assert.equal(calls, 1);
});

test('服务端固定上游且不发送 Cookie，成功结果缓存五分钟并合并并发', async () => {
    let time = Date.parse('2026-10-19T00:00:00Z');
    let calls = 0;
    const handle = createHotMoviesHandler(async (url, options) => {
        calls++;
        assert.match(url, /^https:\/\/m\.douban\.com\/rexxar\/api\/v2\//);
        assert.equal(new Headers(options.headers).has('Cookie'), false);
        assert.equal(options.redirect, 'manual');
        await new Promise(resolve => setTimeout(resolve, 5));
        return Response.json(source(rawMovie()));
    }, () => time);
    const responses = await Promise.all([handle(request()), handle(request())]);
    assert.equal(calls, 1);
    assert.equal(responses[0].status, 200);
    assert.match(responses[0].headers.get('cache-control'), /s-maxage=300/);
    assert.equal((await responses[0].json()).fetchedAt, new Date(time).toISOString());
    time += 60_000;
    assert.match((await handle(request())).headers.get('cache-control'), /s-maxage=240/);
    time += 240_001;
    await handle(new Request('https://example.com/api/hot/movies?url=https://evil.test'));
    assert.equal(calls, 2);
});

test('电影和电视剧使用各自固定上游与独立缓存', async () => {
    const urls = [];
    const fetcher = async (url, options) => {
        urls.push(url);
        assert.equal(new Headers(options.headers).has('Cookie'), false);
        assert.equal(options.headers.Referer, `https://m.douban.com/subject_collection/${url.includes('/tv_real_time_hotest/') ? 'tv' : 'movie'}_real_time_hotest`);
        return Response.json(source(url.includes('/tv_real_time_hotest/') ? rawTV() : rawMovie()));
    };
    const movies = createHotHandler('movie', fetcher);
    const tv = createHotHandler('tv', fetcher);
    assert.equal((await (await movies(request())).json()).items[0].title, '测试电影');
    assert.equal((await (await tv(new Request('https://example.com/api/hot/tv'))).json()).items[0].title, '测试剧集');
    await movies(request());
    await tv(new Request('https://example.com/api/hot/tv'));
    assert.equal(urls.length, 2);
    assert.match(urls[0], /movie_real_time_hotest\/items\?type=movie&start=0&count=10&for_mobile=1$/);
    assert.match(urls[1], /tv_real_time_hotest\/items\?type=tv&start=0&count=10&for_mobile=1$/);
});

test('上游失败和格式变更不缓存、不泄漏原始错误，重试能恢复', async () => {
    for (const failure of [() => new Response('blocked', {status: 403}), () => new Response(null, {
        status: 302,
        headers: {Location: 'https://example.com'}
    }), () => new Response('<html>challenge</html>'),
        () => Response.json({}), () => {
            throw new Error('private detail');
        }]) {
        let calls = 0;
        const handle = createHotMoviesHandler(async () => ++calls === 1 ? failure() : Response.json(source(rawMovie())));
        const failed = await handle(request());
        assert.equal(failed.status, 502);
        assert.equal(failed.headers.get('cache-control'), 'no-store');
        assert.doesNotMatch(await failed.text(), /private|blocked|html/);
        assert.equal((await handle(request())).status, 200);
        assert.equal(calls, 2);
    }
});

test('超时返回 504，不支持的方法返回 405 且不请求上游', async () => {
    let calls = 0;
    const handle = createHotMoviesHandler(async () => {
        calls++;
        throw new DOMException('timed out', 'TimeoutError');
    });
    const response = await handle(new Request(request(), {method: 'POST'}));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
    assert.equal(calls, 0);
    assert.equal((await handle(request())).status, 504);
});
