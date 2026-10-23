import assert from 'node:assert/strict';
import test from 'node:test';
import {getPersonDepartment, getPersonProfile} from '../src/utils/personProfile.ts';

test('人物资料映射职业并保留简介、日期和别名，不修改接口数据', () => {
    const person = {
        id: 1256179, name: ' 钱雁秋 ', known_for_department: 'Creator', gender: 2,
        birthday: '1968-09-30', deathday: null, biography: ' 简介\n第二段 ', popularity: 1.0007,
        also_known_as: ['钱雁秋', ' Yanqiu Qian ', 'Yanqiu Qian', ' '], place_of_birth: null
    };
    const before = structuredClone(person);
    const profile = getPersonProfile(person);
    assert.equal(profile.name, '钱雁秋');
    assert.equal(profile.department, '创作者');
    assert.equal(profile.biography, '简介\n第二段');
    assert.deepEqual(profile.aliases, ['Yanqiu Qian']);
    assert.deepEqual(profile.facts, [{label: '性别', value: '男'}, {label: '出生日期', value: '1968-09-30'}]);
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
        {label: '出生日期', value: '2000-02-29'}, {label: '逝世日期', value: '2020-03-01'}]);
});

test('外链仅允许有效官网和人物 IMDb 编号，拒绝脚本地址与带凭据地址', () => {
    assert.deepEqual(getPersonProfile({id: 1, name: '甲', homepage: 'https://example.com', imdb_id: 'nm1234'}).links,
        [{label: '个人网站', href: 'https://example.com/'}, {label: 'IMDb', href: 'https://www.imdb.com/name/nm1234/'}]);
    for (const homepage of ['javascript:alert(1)', 'data:text/html,test', '/relative', 'https://user:password@example.com']) {
        assert.deepEqual(getPersonProfile({id: 1, name: '甲', homepage, imdb_id: 'tt1234'}).links, []);
    }
});
