import assert from 'node:assert/strict';
import test from 'node:test';
import {getCrewGroups, getOrderedCast} from '../src/utils/movieCredits.ts';

test('演员按 order 排列，同一演员合并角色且不修改接口数据', () => {
    const cast = [
        {id: 2, name: '乙', order: 2, character: '角色乙'},
        {id: 1, name: ' 甲 ', order: 0, character: '主角'},
        {id: 1, name: '甲', order: 3, character: '配角', profile_path: '/a.jpg'},
        {id: 1, name: '甲', order: 4, character: '配角'},
    ];
    const before = structuredClone(cast);
    const result = getOrderedCast(cast);
    assert.deepEqual(result.map(person => person.id), [1, 2]);
    assert.equal(result[0].name, '甲');
    assert.equal(result[0].character, '主角 / 配角');
    assert.equal(result[0].profile_path, '/a.jpg');
    assert.deepEqual(cast, before);
});

test('演员缺失姓名时回退原名，空角色和头像不伪造内容，未提供顺序排在末尾', () => {
    const result = getOrderedCast([
        {id: 1, name: '', original_name: 'Original'},
        {id: 2, name: ' ', original_name: ' '},
        {id: 3, name: '首位', order: 0},
    ]);
    assert.deepEqual(result.map(person => person.name), ['首位', 'Original']);
    assert.equal(result[1].character, '');
    assert.deepEqual(getOrderedCast(), []);
});

test('幕后按本片 job 分类，主创优先，同职务去重且保留一人多职', () => {
    const crew = [
        {id: 1, name: '甲', job: 'Producer', known_for_department: 'Directing'},
        {id: 2, name: '乙', job: 'Writer'},
        {id: 2, name: '乙', job: 'Screenplay'},
        {id: 2, name: '乙', job: 'Director'},
        {id: 3, name: '丙', job: 'Executive Producer'},
        {id: 4, name: '丁', job: 'Action Director'},
    ];
    const before = structuredClone(crew);
    const groups = getCrewGroups(crew);
    assert.deepEqual(groups.map(group => group.label), ['导演', '编剧', '制片', '执行制片', '动作导演']);
    assert.deepEqual(groups[0].members.map(person => person.id), [2]);
    assert.equal(groups[1].members.length, 1);
    assert.deepEqual(crew, before);
});

test('幕后保留未知职务和非主要职务，空姓名不展示', () => {
    assert.deepEqual(getCrewGroups(), []);
    const groups = getCrewGroups([
        {id: 1, name: '', original_name: ' Original ', job: 'Presenter'},
        {id: 2, name: '配乐', job: 'Original Music Composer'},
        {id: 3, name: '', job: 'Director'},
    ]);
    assert.deepEqual(groups.map(group => group.label), ['Presenter', '原创配乐']);
    assert.equal(groups[0].members[0].name, 'Original');
});
