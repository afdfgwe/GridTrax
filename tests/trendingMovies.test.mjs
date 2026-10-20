import test from 'node:test';
import assert from 'node:assert/strict';
import {getTrendingInfo, toTrendingRows} from '../src/utils/trendingMovies.ts';

test('TMDB 日榜保留所有条目和接口顺序，直接使用影片 ID 且不混用豆瓣评分', () => {
    const movies = Array.from({length: 20}, (_, index) => ({
        id: 100 - index, title: `电影${index}`, original_title: `Movie ${index}`,
        release_date: '2026-10-20', vote_average: 8.3, genre_ids: [35, 53],
    }));
    const before = structuredClone(movies);
    const rows = toTrendingRows(movies);
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map(row => row.item.rank), Array.from({length: 20}, (_, index) => index + 1));
    assert.deepEqual(rows.map(row => row.movie.id), movies.map(movie => movie.id));
    assert.equal(rows[0].status, 'matched');
    assert.equal(rows[0].item.year, '2026');
    assert.equal(rows[0].item.rating, undefined);
    assert.equal(rows[0].movie.vote_average, 8.3);
    assert.deepEqual(movies, before);
});

test('TMDB 类型按影片编号顺序用空格分隔，与豆瓣样式一致，原名不再放在资料标签行', () => {
    const genres = [{id: 53, name: '惊悚'}, {id: 35, name: '喜剧'}];
    assert.deepEqual(getTrendingInfo({id: 1, title: '害群之马', original_title: 'Bad Apples',
        release_date: '2026-09-10', genre_ids: [35, 53]}, genres), [
        {label: '上映', value: '2026-09-10'},
        {label: '类型', value: '喜剧 惊悚'},
    ]);
});

test('未知或空白类型名称不展示数字编号，部分缺失不影响已知类型', () => {
    const movie = {id: 1, title: '电影', genre_ids: [35, 999, 53]};
    const genres = [{id: 35, name: ' 喜剧 '}, {id: 53, name: ' '}];
    assert.deepEqual(getTrendingInfo(movie, genres), [{label: '类型', value: '喜剧'}]);
    assert.deepEqual(getTrendingInfo(movie), []);
    assert.deepEqual(getTrendingInfo({id: 1, title: '电影', genre_ids: [999]}, genres), []);
    assert.deepEqual(movie.genre_ids, [35, 999, 53]);
    assert.equal(genres[0].name, ' 喜剧 ');
});

test('TMDB 缺失字段、空数组和空白内容不占资料行，空榜单不伪造影片', () => {
    assert.deepEqual(getTrendingInfo(), []);
    assert.deepEqual(getTrendingInfo({id: 1, title: '电影', original_title: ' ', release_date: '', genre_ids: []}), []);
    assert.deepEqual(toTrendingRows([]), []);
    assert.equal(toTrendingRows([{id: 1, title: '电影'}])[0].item.year, undefined);
    assert.equal(toTrendingRows([{id: 1, title: '电影', release_date: ''}])[0].item.year, undefined);
});

test('电视剧榜映射标题、原名和首播日期，保留海报、简介、评分及地区和榜单顺序', () => {
    const shows = [
        {id: 123542, name: '时光代理人', original_name: '时光代理人', first_air_date: '2021-04-30',
            vote_average: 8, poster_path: '/poster.jpg', overview: '时光照相馆', genre_ids: [16, 10765], origin_country: ['CN']},
        {id: 105248, name: '赛博朋克：边缘行者', original_name: 'Cyberpunk: Edgerunners', first_air_date: '2022-09-13',
            vote_average: 8.488, origin_country: ['JP', 'PL', 'US']},
    ];
    const before = structuredClone(shows);
    const rows = toTrendingRows(shows);
    assert.deepEqual(rows.map(row => row.item.title), ['时光代理人', '赛博朋克：边缘行者']);
    assert.deepEqual(rows.map(row => row.item.year), ['2021', '2022']);
    assert.deepEqual(rows.map(row => row.item.rank), [1, 2]);
    assert.deepEqual(rows.map(row => row.movie.id), [123542, 105248]);
    assert.equal(rows[1].movie.original_title, 'Cyberpunk: Edgerunners');
    assert.equal(rows[0].movie.release_date, '2021-04-30');
    assert.equal(rows[0].movie.poster_path, '/poster.jpg');
    assert.equal(rows[0].movie.overview, '时光照相馆');
    assert.equal(rows[1].movie.vote_average, 8.488);
    assert.deepEqual(rows[0].movie.genre_ids, [16, 10765]);
    assert.deepEqual(rows[1].movie.origin_country, ['JP', 'PL', 'US']);
    assert.equal(rows[0].item.rating, undefined);
    assert.ok(rows.every(row => row.status === 'matched'));
    assert.deepEqual(shows, before);
});

test('地区字典缺失时保留原始代码，专属类型使用电视剧字典，均以空格分隔', () => {
    const [row] = toTrendingRows([{id: 1, name: '电视剧', first_air_date: '2022-09-13',
        origin_country: [' JP ', '', 'PL', 'US'], genre_ids: [10759, 10765, 10768]}]);
    const genres = [{id: 10765, name: '科幻与奇幻'}, {id: 10768, name: '战争与政治'}, {id: 10759, name: '动作冒险'}];
    assert.deepEqual(getTrendingInfo(row.movie, genres), [
        {label: '上映', value: '2022-09-13'},
        {label: '地区', value: 'JP PL US'},
        {label: '类型', value: '动作冒险 科幻与奇幻 战争与政治'},
    ]);
});

test('电视剧缺失可选信息及空白地区不占资料行，不丢失标题和详情 ID', () => {
    const [row] = toTrendingRows([{id: 9, name: '电视剧', origin_country: [' ', ''], genre_ids: []}]);
    assert.equal(row.item.title, '电视剧');
    assert.equal(row.movie.id, 9);
    assert.equal(row.item.year, undefined);
    assert.equal(row.movie.original_title, undefined);
    assert.deepEqual(getTrendingInfo(row.movie), []);
    assert.deepEqual(getTrendingInfo(toTrendingRows([{id: 2, name: '电视剧', origin_country: []}])[0].movie), []);
});

test('电视剧类型字典残留的英文名称补齐中文翻译，其他名称保持接口内容', () => {
    const genres = [{id: 10765, name: ' Sci-Fi & Fantasy '}, {id: 10768, name: 'War & Politics'},
        {id: 16, name: '动画'}, {id: 10759, name: '动作冒险'}];
    const before = structuredClone(genres);
    assert.deepEqual(getTrendingInfo({id: 1, title: '电视剧', genre_ids: [16, 10765, 10768, 10759]}, genres), [
        {label: '类型', value: '动画 科幻与奇幻 战争与政治 动作冒险'},
    ]);
    assert.deepEqual(genres, before);
    assert.deepEqual(getTrendingInfo({id: 1, title: '电视剧', genre_ids: [10765]}, [
        {id: 10765, name: '科幻奇幻'},
    ]), [{label: '类型', value: '科幻奇幻'}]);
});

test('地区按 origin_country 顺序使用字典的中文名称，以空格分隔且不修改接口数据', () => {
    const movie = {id: 1, title: '电视剧', origin_country: [' jp ', 'CN', 'US', '']};
    const countries = [
        {iso_3166_1: 'CN', english_name: 'China', native_name: '中国'},
        {iso_3166_1: 'US', english_name: 'United States of America', native_name: '美国'},
        {iso_3166_1: 'JP', english_name: 'Japan', native_name: ' 日本 '},
    ];
    const before = structuredClone({movie, countries});
    assert.deepEqual(getTrendingInfo(movie, [], countries), [{label: '地区', value: '日本 中国 美国'}]);
    assert.deepEqual({movie, countries}, before);
});

test('未知地区保留代码，地区名称空白时回退英文名或代码，不影响中文类型', () => {
    const movie = {id: 1, title: '电视剧', origin_country: ['AD', 'AE', 'XX', ' '], genre_ids: [16]};
    const countries = [
        {iso_3166_1: 'AD', english_name: ' Andorra ', native_name: ' '},
        {iso_3166_1: 'AE', english_name: ' ', native_name: ''},
    ];
    assert.deepEqual(getTrendingInfo(movie, [{id: 16, name: '动画'}], countries), [
        {label: '地区', value: 'Andorra AE XX'}, {label: '类型', value: '动画'},
    ]);
    assert.deepEqual(getTrendingInfo({id: 1, title: '电视剧', origin_country: []}, [], countries), []);
    assert.deepEqual(getTrendingInfo(undefined, [], countries), []);
});
