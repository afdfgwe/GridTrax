import assert from 'node:assert/strict';
import test from 'node:test';
import { getEpisodeTitle } from '../src/components/episodeTitle.ts';

test('keeps real titles and trims surrounding whitespace', () => {
    for (const title of ['The Long Goodbye', '初次相遇', 'Episode 1: A New Beginning', '1984年的夏天']) {
        assert.equal(getEpisodeTitle({ name: `  ${title}  ` }), title);
    }
});

test('ignores missing and empty titles', () => {
    for (const name of [undefined, null, '', '  ']) {
        assert.equal(getEpisodeTitle({ name }), '');
    }
});

test('ignores numbered placeholders in Chinese and English', () => {
    for (const name of ['第 1 集', '第01集', '第一集', '第十二話', '第 ２５ 集', 'Episode 1', 'episode 02', 'EP. 3', 'EP4', '25']) {
        assert.equal(getEpisodeTitle({ name }), '', name);
    }
});

test('a title anywhere in the season enables the toggle, not just the current page', () => {
    const episodes = Array.from({ length: 25 }, (_, index) => ({ name: `Episode ${index + 1}` }));
    assert.equal(episodes.some(episode => getEpisodeTitle(episode)), false);
    episodes[24].name = 'The Last Day';
    assert.equal(episodes.slice(0, 18).some(episode => getEpisodeTitle(episode)), false);
    assert.equal(episodes.some(episode => getEpisodeTitle(episode)), true);
});
