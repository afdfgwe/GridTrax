import assert from 'node:assert/strict';
import test from 'node:test';
import {getEpisodeDetails} from '../src/utils/episodeDetails.ts';

// 保留真实段落，仅清理边缘空白；缺失字段由组件隐藏，而不是用虚构内容补齐。
test('单集详情保留首播日期、时长与简介段落，不修改接口数据', () => {
    const episode = {air_date: ' 2004-08-05 ', runtime: 45, overview: ' 本集内容\n\n第二段 '};
    const before = structuredClone(episode);
    assert.deepEqual(getEpisodeDetails(episode), {airDate: '2004-08-05', runtime: 45, overview: '本集内容\n\n第二段'});
    assert.deepEqual(episode, before);
});

test('缺失、空白与空值不提供占位详情', () => {
    for (const episode of [{}, {air_date: null, runtime: null, overview: null}, {
        air_date: ' ',
        overview: ' \n ',
        runtime: 0
    }]) {
        assert.deepEqual(getEpisodeDetails(episode), {airDate: '', runtime: undefined, overview: ''});
    }
});

test('无效时长和日期被过滤，部分字段缺失不影响其余详情', () => {
    for (const runtime of [0, -1, NaN, Infinity, -Infinity, '45']) {
        assert.equal(getEpisodeDetails({runtime}).runtime, undefined);
    }
    for (const air_date of ['2020', '2020-01', 'unknown']) {
        assert.equal(getEpisodeDetails({air_date}).airDate, '');
    }
    assert.deepEqual(getEpisodeDetails({runtime: 22, overview: '独立的本集简介'}), {
        airDate: '', runtime: 22, overview: '独立的本集简介',
    });
});
