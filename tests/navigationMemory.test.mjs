import assert from 'node:assert/strict';
import test from 'node:test';
import {createNavigationMemory} from '../src/utils/navigationMemory.ts';

test('按历史条目隔离滚动和板块页码，两类状态互不覆盖', () => {
    const memory = createNavigationMemory(2);
    memory.set('home-a', {scroll: 1200});
    memory.set('home-a', {pages: {Wish: 2}});
    memory.set('detail', {scroll: 0});
    assert.deepEqual(memory.get('home-a'), {scroll: 1200, pages: {Wish: 2}});
    memory.set('home-b', {pages: {Wish: 0}});
    assert.equal(memory.get('home-a'), undefined);
    assert.deepEqual(memory.get('home-b'), {pages: {Wish: 0}});
});
