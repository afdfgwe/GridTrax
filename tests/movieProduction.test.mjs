import assert from 'node:assert/strict';
import test from 'node:test';
import {getProductionCountriesText} from '../src/utils/movieProduction.ts';

const countries = [
    {iso_3166_1: 'US', name: 'United States of America'},
    {iso_3166_1: 'DE', name: 'Germany'},
    {iso_3166_1: 'FR', name: 'France'},
];
const dictionary = [
    {iso_3166_1: 'US', english_name: 'United States of America', native_name: '美国'},
    {iso_3166_1: 'DE', english_name: 'Germany', native_name: '德国'},
    {iso_3166_1: 'FR', english_name: 'France', native_name: '法国'},
];

test('电视剧使用相同字段将制片地区转换成中文', () => {
    assert.equal(getProductionCountriesText([{iso_3166_1: 'CN', name: 'China'}], [
        {iso_3166_1: 'CN', english_name: 'China', native_name: '中国'},
    ]), '中国');
});

test('制片地区按接口顺序显示中文，不修改原始数据', () => {
    const before = structuredClone(countries);
    assert.equal(getProductionCountriesText(countries, dictionary), '美国、德国、法国');
    assert.deepEqual(countries, before);
});

test('地区字典未加载或失败时回退接口名称，部分匹配不丢失地区', () => {
    assert.equal(getProductionCountriesText(countries), 'United States of America、Germany、France');
    assert.equal(getProductionCountriesText(countries, dictionary.slice(0, 1)), '美国、Germany、France');
});

test('地区代码忽略空格和大小写，相同地区不重复显示', () => {
    assert.equal(getProductionCountriesText([
        {iso_3166_1: ' us ', name: 'United States'},
        ...countries,
    ], dictionary), '美国、德国、法国');
});

test('字典名称为空时回退接口名称或代码，缺失数据不显示空行', () => {
    assert.equal(getProductionCountriesText([{iso_3166_1: 'XY', name: ' '}]), 'XY');
    for (const value of [undefined, null, [], [{iso_3166_1: '', name: ' '}]]) {
        assert.equal(getProductionCountriesText(value), '');
    }
    assert.equal(getProductionCountriesText(countries, [{
        iso_3166_1: 'US', native_name: '', english_name: '美国',
    }]), '美国、Germany、France');
});
