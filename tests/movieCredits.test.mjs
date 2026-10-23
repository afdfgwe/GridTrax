import assert from 'node:assert/strict';
import test from 'node:test';
import {getCrewGroups, getOrderedCast, normalizeTVAggregateCredits} from '../src/utils/movieCredits.ts';

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
    assert.deepEqual(groups.map(group => group.label), ['出品人', '原创配乐']);
    assert.equal(groups[0].members[0].name, 'Original');
});

test('整剧汇总合并多个角色，忽略空白和重复项，仍按 order 排列而不是出场集数', () => {
    const data = {id: 44277, crew: [], cast: [
        {id: 1, name: '梁冠华', order: 50, total_episode_count: 212,
            roles: [{character: '狄仁杰'}, {character: ''}, {character: ' 狄仁杰 '}]},
        {id: 2, name: '曲栅栅', order: 13, total_episode_count: 92,
            roles: [{character: '如燕'}, {character: '宁氏'}, {character: '  '}]},
        {id: 3, name: '张子健', order: 2, roles: [{character: '李元芳'}]},
    ]};
    const before = structuredClone(data);
    const normalized = normalizeTVAggregateCredits(data);
    const cast = getOrderedCast(normalized.cast);
    assert.equal(normalized.id, 44277);
    assert.deepEqual(cast.map(person => person.name), ['张子健', '曲栅栅', '梁冠华']);
    assert.equal(cast[1].character, '如燕 / 宁氏');
    assert.equal(cast[2].character, '狄仁杰');
    assert.deepEqual(data, before);
});

test('整剧幕后展开 jobs，保留一人多职，同职务和同组编剧只展示一次', () => {
    const data = {id: 44277, cast: [], crew: [
        {id: 1, name: '钱雁秋', department: 'Directing', jobs: [
            {job: 'Director', credit_id: 'director'}, {job: 'Writer'}, {job: 'Screenplay'}, {job: 'Director'},
        ]},
        {id: 2, name: '谭友业', jobs: [{job: 'Director'}]},
        {id: 3, name: '张文玲', jobs: [{job: 'Producer'}]},
    ]};
    const before = structuredClone(data);
    const normalized = normalizeTVAggregateCredits(data);
    const crew = getCrewGroups(normalized.crew);
    assert.deepEqual(crew.map(group => group.label), ['导演', '编剧', '制片']);
    assert.deepEqual(crew[0].members.map(person => person.name), ['钱雁秋', '谭友业']);
    assert.equal(crew[1].members.length, 1);
    assert.equal(crew[0].members[0].credit_id, 'director');
    assert.deepEqual(data, before);
});

test('整剧角色和职务缺失时不伪造内容，缺少照片与角色的演员仍保留', () => {
    assert.deepEqual(normalizeTVAggregateCredits({id: 1, cast: [], crew: []}), {id: 1, cast: [], crew: []});
    const data = {id: 2, cast: [
        {id: 1, name: '甲', profile_path: null, roles: null},
        {id: 2, name: '乙'},
    ], crew: [{id: 3, name: '丙'}, {id: 4, name: '丁', jobs: null}]};
    const normalized = normalizeTVAggregateCredits(data);
    assert.equal(normalized.cast.length, 2);
    assert.equal(normalized.cast[0].profile_path, null);
    assert.deepEqual(normalized.cast.map(person => person.character), ['', '']);
    assert.deepEqual(normalized.crew, []);
});
