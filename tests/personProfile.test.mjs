import assert from 'node:assert/strict';
import test from 'node:test';
import {getPersonDepartment, getPersonProfile} from '../src/utils/personProfile.ts';

// 覆盖人物资料的字段映射与展示规则：职业翻译、别名、出生/逝世日期校验、年龄与享年计算及外链白名单。

test('人物资料映射职业并保留简介、日期和别名，不修改接口数据', () => {
    const person = {
        id: 1256179, name: ' 钱雁秋 ', known_for_department: 'Creator', gender: 2,
        birthday: '1968-09-30', deathday: null, biography: ' 简介\n第二段 ', popularity: 1.0007,
        also_known_as: ['钱雁秋', ' Yanqiu Qian ', 'Yanqiu Qian', ' '], place_of_birth: null
    };
    const before = structuredClone(person);
    const profile = getPersonProfile(person, new Date(2026, 9, 23));
    assert.equal(profile.name, '钱雁秋');
    assert.equal(profile.department, '创作者');
    assert.equal(profile.biography, '简介\n第二段');
    assert.deepEqual(profile.aliases, ['Yanqiu Qian']);
    assert.deepEqual(profile.facts, [{label: '性别', value: '男'}, {label: '出生日期', value: '1968-09-30'},
        {label: '年龄', value: '58 岁'}]);
    assert.deepEqual(person, before);
});

test('缺失资料、未知性别和非法日期不提供占位值，长姓名和出生地完整保留', () => {
    const profile = getPersonProfile({
        id: 1, name: '长姓名'.repeat(20), birthday: '2000-02-30',
        deathday: 'bad', gender: 0, popularity: NaN, also_known_as: null, place_of_birth: ' 北京 '
    });
    assert.equal(profile.name, '长姓名'.repeat(20));
    assert.deepEqual(profile.facts, [{label: '出生地', value: '北京'}]);
    assert.equal(profile.biography, '');
    assert.deepEqual(profile.links, []);
    assert.equal(getPersonDepartment('New Department'), 'New Department');
    assert.equal(getPersonDepartment(null), '');
});

test('人物日期校验保留闰日、逝世日期与性别，不展示热度', () => {
    const profile = getPersonProfile({
        id: 1, name: '甲', gender: 3, birthday: '2000-02-29',
        deathday: '2020-03-01', popularity: 0
    });
    assert.deepEqual(profile.facts, [{label: '性别', value: '非二元性别'},
        {label: '出生日期', value: '2000-02-29'}, {label: '享年', value: '20 岁'},
        {label: '逝世日期', value: '2020-03-01'}]);
});

test('年龄按周岁计算，生日前一天、当天和之后分别处理', () => {
    const person = {id: 1, name: '甲', birthday: '2000-10-23'};
    // 生日为 10-23：前一天仍是 25 岁，当天及之后满 26 岁。
    for (const [day, age] of [[22, 25], [23, 26], [24, 26]]) {
        const profile = getPersonProfile(person, new Date(2026, 9, day));
        assert.deepEqual(profile.facts.find(fact => fact.label === '年龄'), {label: '年龄', value: `${age} 岁`});
    }
    const newborn = getPersonProfile({...person, birthday: '2026-10-23'}, new Date(2026, 9, 23));
    assert.deepEqual(newborn.facts.find(fact => fact.label === '年龄'), {label: '年龄', value: '0 岁'});
});

test('享年固定为逝世时周岁，不随当前日期增长', () => {
    const person = {id: 1, name: '甲', birthday: '1950-10-23', deathday: '2020-10-22'};
    for (const year of [2025, 2026, 2030]) {
        const profile = getPersonProfile(person, new Date(year, 9, 23));
        assert.deepEqual(profile.facts.find(fact => fact.label === '享年'), {label: '享年', value: '69 岁'});
        assert.ok(!profile.facts.some(fact => fact.label === '年龄'));
    }
});

test('闰日生日按月日比较，非闰年三月一日满周岁', () => {
    const person = {id: 1, name: '甲', birthday: '2000-02-29'};
    for (const [date, age] of [[new Date(2023, 1, 28), 22], [new Date(2023, 2, 1), 23],
        [new Date(2024, 1, 29), 24]]) {
        assert.equal(getPersonProfile(person, date).facts.find(fact => fact.label === '年龄')?.value, `${age} 岁`);
    }
});

test('缺失、未来和前后矛盾的日期不显示年龄或享年', () => {
    const now = new Date(2026, 9, 23);
    for (const dates of [{}, {birthday: null}, {birthday: 'bad'}, {birthday: '2000-02-30'},
        {birthday: '2027-01-01'}, {birthday: '2000-01-01', deathday: '1999-12-31'},
        {birthday: '2000-01-01', deathday: 'bad'}, {birthday: '2000-01-01', deathday: '2027-01-01'}]) {
        const profile = getPersonProfile({id: 1, name: '甲', ...dates}, now);
        assert.ok(!profile.facts.some(fact => fact.label === '年龄' || fact.label === '享年'));
    }
});

test('外链仅允许有效官网和人物 IMDb 编号，拒绝脚本地址与带凭据地址', () => {
    assert.deepEqual(getPersonProfile({id: 1, name: '甲', homepage: 'https://example.com', imdb_id: 'nm1234'}).links,
        [{label: '个人网站', href: 'https://example.com/'}, {label: 'IMDb', href: 'https://www.imdb.com/name/nm1234/'}]);
    for (const homepage of ['javascript:alert(1)', 'data:text/html,test', '/relative', 'https://user:password@example.com']) {
        assert.deepEqual(getPersonProfile({id: 1, name: '甲', homepage, imdb_id: 'tt1234'}).links, []);
    }
});
