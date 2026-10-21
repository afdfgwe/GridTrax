import assert from 'node:assert/strict';
import test from 'node:test';
import {getMediaYearKey, getMediaYears} from '../src/utils/mediaYears.ts';

// 年份与评分的回退策略不同：季年份缺失就隐藏，不能借用整剧首播年。
test('同剧多季按季号读取各自年份，不依赖摘要顺序或整部剧首播年', () => {
    const show = {
        id: 10, first_air_date: '2000-01-01',
        seasons: [
            {season_number: 2, air_date: '2024-03-01'},
            {season_number: 1, air_date: '2021-05-01'},
        ],
    };
    const before = structuredClone(show);
    const years = getMediaYears(show);
    for (const [season_number, expected] of [[1, '2021'], [2, '2024']]) {
        assert.equal(years[getMediaYearKey({type: 'tv_season', tmdb_id: 10, season_number})], expected);
    }
    assert.deepEqual(show, before);
});

test('季日期缺失、空值或无效时不回退到整部剧的年份', () => {
    const years = getMediaYears({
        id: 10, first_air_date: '2000-01-01',
        seasons: [undefined, null, '', 'unknown'].map((air_date, index) => ({season_number: index + 1, air_date})),
    });
    assert.deepEqual(Object.values(years), ['', '', '', '']);
    assert.equal(years[getMediaYearKey({type: 'tv_season', tmdb_id: 10, season_number: 99})], undefined);
});

test('特别篇使用季号零，电影和同编号电视剧的年份互不影响', () => {
    const years = {
        ...getMediaYears({id: 10, seasons: [{season_number: 0, air_date: '2025-01-01'}]}),
        ...getMediaYears({id: 10, release_date: '1999-02-01'}),
    };
    assert.equal(years[getMediaYearKey({type: 'tv_season', tmdb_id: 10, season_number: 0})], '2025');
    assert.equal(years[getMediaYearKey({type: 'movie', tmdb_id: 10})], '1999');
});

test('电影缺少上映日期和剧集没有季摘要时不生成错误年份', () => {
    for (const release_date of [undefined, null, '', 'unknown']) {
        assert.deepEqual(getMediaYears({id: 10, release_date}), {'movie-10': ''});
    }
    assert.deepEqual(getMediaYears({id: 10, first_air_date: '2000-01-01', seasons: []}), {});
});
