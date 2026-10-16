import assert from 'node:assert/strict';
import test from 'node:test';
import {getEpisodeTitle} from '../src/components/episodeTitle.ts';

// 真实短标题保留原文，只去除首尾空白；含集号但有额外剧情文字也不能误删。
test('keeps real titles and trims surrounding whitespace', () => {
    for (const title of ['The Long Goodbye', '初次相遇', 'Episode 1: A New Beginning', '1984年的夏天']) {
        assert.equal(getEpisodeTitle({name: `  ${title}  `}), title);
    }
});

// 接口未提供标题或仅提供空白时，不应开启依赖短标题的展示。
test('ignores missing and empty titles', () => {
    for (const name of [undefined, null, '', '  ']) {
        assert.equal(getEpisodeTitle({name}), '');
    }
});

// 覆盖中英文占位名、中文数字与全角数字，避免把重复集号当作有效短标题。
test('ignores numbered placeholders in Chinese and English', () => {
    for (const name of ['第 1 集', '第01集', '第一集', '第十二話', '第 ２５ 集', 'Episode 1', 'episode 02', 'EP. 3', 'EP4', '25']) {
        assert.equal(getEpisodeTitle({name}), '', name);
    }
});

// 即使标题在第 25 集而首页只显示前 18 集，也应按完整一季决定是否提供切换按钮。
test('a title anywhere in the season enables the toggle, not just the current page', () => {
    const episodes = Array.from({length: 25}, (_, index) => ({name: `Episode ${index + 1}`}));
    assert.equal(episodes.some(episode => getEpisodeTitle(episode)), false);
    episodes[24].name = 'The Last Day';
    assert.equal(episodes.slice(0, 18).some(episode => getEpisodeTitle(episode)), false);
    assert.equal(episodes.some(episode => getEpisodeTitle(episode)), true);
});
