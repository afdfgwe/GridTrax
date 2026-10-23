import assert from 'node:assert/strict';
import test from 'node:test';
import {groupPersonWorks, normalizePersonCredits} from '../src/utils/personCredits.ts';

test('同一作品合并所有角色和幕后职务，不修改接口数据，电影和电视剧编号互不冲突', () => {
    const data = {id: 1, cast: [
        {id: 10, media_type: 'movie', title: ' 电影 ', release_date: '', character: ' 甲 ', vote_average: 0},
        {id: 10, media_type: 'movie', title: '电影', character: '乙', poster_path: '/poster.jpg'},
        {id: 10, media_type: 'movie', title: '电影', character: '甲'},
        {id: 10, media_type: 'tv', name: '电视剧', first_air_date: '2020-01-02', character: ''},
    ], crew: [
        {id: 10, media_type: 'movie', title: '电影', job: 'Director', release_date: '2026-10-23', vote_average: 8.2},
        {id: 10, media_type: 'movie', title: '电影', job: 'Writer'},
        {id: 10, media_type: 'movie', title: '电影', job: 'Screenplay'},
        {id: 10, media_type: 'movie', title: '电影', job: 'Director'},
    ]};
    const before = structuredClone(data);
    const works = normalizePersonCredits(data);
    assert.equal(works.length, 2);
    assert.deepEqual(works[0], {key: 'movie:10', id: 10, mediaType: 'movie', title: '电影',
        date: '2026-10-23', year: '2026', cast: true, characters: ['甲', '乙'], jobs: ['导演', '编剧'],
        posterPath: '/poster.jpg', score: 8.2});
    assert.equal(works[1].key, 'tv:10');
    assert.equal(works[1].cast, true);
    assert.deepEqual(works[1].characters, []);
    assert.deepEqual(data, before);
});

test('按作品类型映射片名与日期，缺失资料不伪造角色、评分、海报或年份', () => {
    const works = normalizePersonCredits({id: 1, cast: [
        {id: 1, media_type: 'movie', title: '', original_title: ' Original ', name: '不使用电视剧片名',
            first_air_date: '2001-01-01', character: null, poster_path: null, vote_average: 0},
        {id: 2, media_type: 'tv', name: '', original_name: ' 剧集 ', release_date: '2000-01-01', vote_average: -1},
        {id: 3, media_type: 'movie', title: '无评分', vote_average: NaN},
        {id: 4, media_type: 'movie', title: '异常评分', vote_average: 11},
    ], crew: []});
    assert.deepEqual(works.map(work => work.title), ['Original', '剧集', '无评分', '异常评分']);
    assert.ok(works.every(work => work.score === undefined && work.date === '' && work.year === ''
        && !work.posterPath && work.characters.length === 0));
});

test('跳过无效编号、不支持的类型和空片名，保留只有幕后职务的作品', () => {
    const works = normalizePersonCredits({id: 1, cast: [
        {id: 0, media_type: 'movie', title: '无效编号'},
        {id: -1, media_type: 'movie', title: '负数编号'},
        {id: 1.5, media_type: 'movie', title: '小数编号'},
        {id: 1, media_type: 'person', name: '人物'},
        {id: 2, media_type: 'tv', title: '不能代替剧名'},
        {id: 3, media_type: 'movie', title: ' ', original_title: ' '},
    ], crew: [{id: 4, media_type: 'tv', name: '幕后作品', job: 'New Job'}]});
    assert.equal(works.length, 1);
    assert.equal(works[0].cast, false);
    assert.deepEqual(works[0].jobs, ['New Job']);
    assert.deepEqual(normalizePersonCredits({id: 1, cast: [], crew: []}), []);
});

test('幕后常见职务使用中文名称，重复译名只保留一次，空职务保留其他幕后', () => {
    const works = normalizePersonCredits({id: 1, cast: [], crew:
        ['Martial Arts Choreographer', 'Action Director', 'Stunt Coordinator', 'Stunts',
            'Presenter', 'Production Manager', 'Thanks', null].map(job => ({id: 1, media_type: 'movie', title: '甲', job}))});
    assert.deepEqual(works[0].jobs, ['武术指导', '动作导演', '特技指导', '特技演员', '出品人', '制片主任', '鸣谢', '其他幕后']);
});

test('按年份和日期倒序分组，未来日期正常保留，缺失或非法日期放末尾', () => {
    const dates = ['2020-01-01', '2026-01-01', '2026-10-23', '2030-01-01', '',
        '2020-02-30', 'bad', '0000-01-01', '2024-02-29'];
    const works = normalizePersonCredits({id: 1, crew: [], cast: dates.map((release_date, index) => ({
        id: index + 1, media_type: 'movie', title: `电影${index}`, release_date
    }))});
    const before = structuredClone(works);
    const groups = groupPersonWorks(works);
    assert.deepEqual(groups.map(group => group.year), ['2030', '2026', '2024', '2020', '']);
    assert.deepEqual(groups[1].works.map(work => work.id), [3, 2]);
    assert.equal(groups.at(-1).works.length, 4);
    assert.deepEqual(works, before);
});

test('类型、职务和年份可组合筛选，出演兼幕后作品不会重复，也不丢失其他职务', () => {
    const works = normalizePersonCredits({id: 1, cast: [
        {id: 1, media_type: 'movie', title: '电影', character: '甲', release_date: '2026-01-01'},
        {id: 2, media_type: 'tv', name: '剧集', first_air_date: '2025-01-01'},
    ], crew: [
        {id: 1, media_type: 'movie', title: '电影', job: 'Director'},
        {id: 1, media_type: 'movie', title: '电影', job: 'Producer'},
        {id: 3, media_type: 'tv', name: '无日期剧集', job: 'Director'},
    ]});
    assert.equal(groupPersonWorks(works, {mediaType: 'movie', job: '导演', year: '2026'})[0].works.length, 1);
    assert.deepEqual(groupPersonWorks(works, {job: '导演', year: '2026'})[0].works[0].jobs, ['导演', '制片']);
    assert.equal(groupPersonWorks(works, {job: '出演'}).flatMap(group => group.works).length, 2);
    assert.equal(groupPersonWorks(works, {mediaType: 'tv', job: '导演', year: 'unknown'})[0].works[0].id, 3);
    assert.deepEqual(groupPersonWorks(works, {mediaType: 'tv', year: '2026'}), []);
});
