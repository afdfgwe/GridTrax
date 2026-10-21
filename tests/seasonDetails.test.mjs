import assert from 'node:assert/strict';
import test from 'node:test';
import {getSeasonOverview, getSeasonTitle} from '../src/utils/seasonDetails.ts';

// 常规季名可规范化，自定义篇章名必须保留；两者都不应改写接口原数据。
test('常规季名不重复季号，支持中英文占位名称和缺失名称', () => {
    for (const name of ['第 1 季', '第1季', '第一季', 'Season 1', '', undefined]) {
        assert.equal(getSeasonTitle({season_number: 1, name}), '第 1 季');
    }
});

test('自定义季名保留季号，且不修改接口数据', () => {
    const season = {season_number: 4, name: ' 神断狄仁杰 '};
    const before = structuredClone(season);
    assert.equal(getSeasonTitle(season), '第 4 季 · 神断狄仁杰');
    assert.deepEqual(season, before);
});

test('仅一季时忽略空格换行后去重，独立简介保留原始段落', () => {
    assert.equal(getSeasonOverview(' 整剧\n 简介 ', '整剧简介', true), '');
    assert.equal(getSeasonOverview(' 本季简介\n\n下一段 ', '整剧简介', true), '本季简介\n\n下一段');
    assert.equal(getSeasonOverview('相同简介', '相同简介', false), '相同简介');
});

test('没有本季简介时不使用整剧简介占位', () => {
    for (const overview of ['', ' \n ', undefined, null]) {
        assert.equal(getSeasonOverview(overview, '整剧简介', false), '');
    }
});
