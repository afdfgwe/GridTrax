import assert from 'node:assert/strict';
import test from 'node:test';
import {
    filterMediaImagesByCountry,
    getMediaImageCountries,
    getMediaImageMetadata,
    getMediaImagesPath,
    normalizeMediaImages,
    withCurrentMediaImage
} from '../src/utils/mediaImages.ts';

test('国家分类合并重复代码并使用中文名称，不从图片语言推断国家', () => {
    const photos = Object.freeze([
        {file_path: '/a.jpg', iso_3166_1: ' us '},
        {file_path: '/b.jpg', iso_3166_1: 'US'},
        {file_path: '/c.jpg', iso_3166_1: null, iso_639_1: 'zh'},
        {file_path: '/d.jpg', iso_3166_1: ' '},
        {file_path: '/e.jpg', iso_3166_1: 'DE'},
    ]);
    assert.deepEqual(getMediaImageCountries(photos, [{
        iso_3166_1: 'US',
        native_name: '美国',
        english_name: 'United States'
    }]), [
        {code: 'US', name: '美国', count: 2}, {code: '', name: '未提供国家', count: 2}, {code: 'DE', name: 'DE', count: 1},
    ]);
    assert.deepEqual(getMediaImageCountries(photos).map(item => item.name), ['US', '未提供国家', 'DE']);
    assert.deepEqual(getMediaImageCountries([]), []);
});

test('国家数量与当前分类筛选结果一致，不把剧照和海报合并统计', () => {
    const images = {
        backdrops: [
            {file_path: '/a.jpg', iso_3166_1: 'US'},
            {file_path: '/b.jpg', iso_3166_1: ' us '},
            {file_path: '/c.jpg', iso_3166_1: 'CN'},
            {file_path: '/d.jpg', iso_639_1: 'en'},
        ],
        posters: [
            {file_path: '/e.jpg', iso_3166_1: 'CN'},
            {file_path: '/f.jpg', iso_3166_1: 'CN'},
            {file_path: '/g.jpg', iso_3166_1: null},
        ],
    };
    for (const photos of Object.values(images)) {
        const options = getMediaImageCountries(photos);
        assert.equal(options.reduce((sum, option) => sum + option.count, 0), photos.length);
        for (const option of options) {
            assert.equal(option.count, filterMediaImagesByCountry(photos, option.code).length);
        }
    }
    const counts = new Map(getMediaImageCountries(images.posters).map(option => [option.code, option.count]));
    assert.equal(counts.get('US') ?? 0, 0);
    assert.equal(counts.get('CN'), 2);
    assert.equal(counts.get(''), 1);
});

test('国家筛选保留图片顺序和全部国家引用，区分未提供国家与无匹配项', () => {
    const photos = Object.freeze([
        Object.freeze({file_path: '/a.jpg', iso_3166_1: 'us'}),
        Object.freeze({file_path: '/b.jpg', iso_639_1: 'en'}),
        Object.freeze({file_path: '/c.jpg', iso_3166_1: ' US '}),
        Object.freeze({file_path: '/d.jpg', iso_3166_1: null}),
    ]);
    assert.equal(filterMediaImagesByCountry(photos, '*'), photos);
    assert.deepEqual(filterMediaImagesByCountry(photos, ' us '), [photos[0], photos[2]]);
    assert.deepEqual(filterMediaImagesByCountry(photos, ''), [photos[1], photos[3]]);
    assert.deepEqual(filterMediaImagesByCountry(photos, 'CN'), []);
    assert.deepEqual(filterMediaImagesByCountry([], '*'), []);
    assert.equal(photos.length, 4);
});

test('图片元数据按中文展示，不用语言推断国家，尺寸仅接受正整数', () => {
    assert.deepEqual(getMediaImageMetadata({file_path: '/a.jpg', iso_639_1: 'zh', width: 1920, height: 1080}), [
        {label: '国家', value: '未提供'}, {label: '语言', value: '中文'},
        {label: '尺寸', value: '1920 × 1080'},
    ]);
    assert.equal(getMediaImageMetadata({file_path: '/a.jpg', iso_3166_1: 'cn', iso_639_1: 'en'})[0].value, 'CN');
    assert.equal(getMediaImageMetadata({file_path: '/a.jpg', iso_639_1: null})[1].value, '无语言');
    assert.equal(getMediaImageMetadata({file_path: '/a.jpg'})[1].value, '未提供');
    for (const width of [0, -1, Infinity, NaN, 1.2, '100', undefined]) {
        assert.equal(getMediaImageMetadata({file_path: '/a.jpg', width})[2].value, '未提供');
    }
});

test('图片尺寸合并为宽乘高，部分缺失保留已知尺寸，不显示无效数字', () => {
    const size = photo => getMediaImageMetadata({file_path: '/a.jpg', ...photo})[2];
    assert.deepEqual(size({width: 1000, height: 1500}), {label: '尺寸', value: '1000 × 1500'});
    assert.deepEqual(size({width: 1920}), {label: '尺寸', value: '1920 × 未提供'});
    assert.deepEqual(size({height: 1080}), {label: '尺寸', value: '未提供 × 1080'});
    assert.deepEqual(size({width: 0, height: -1}), {label: '尺寸', value: '未提供'});
});

test('图片国家使用接口地区字典，优先中文名称，缺失时依次回退英文和代码', () => {
    const countries = Object.freeze([
        Object.freeze({iso_3166_1: 'US', native_name: ' 美国 ', english_name: 'United States of America'}),
        Object.freeze({iso_3166_1: ' cn ', native_name: '接口中文名称', english_name: 'China'}),
        Object.freeze({iso_3166_1: 'DE', native_name: ' ', english_name: ' Germany '}),
        Object.freeze({iso_3166_1: 'FR', native_name: '', english_name: ''}),
    ]);
    const countryName = code => getMediaImageMetadata({file_path: '/a.jpg', iso_3166_1: code}, countries)[0].value;
    assert.equal(countryName('us'), '美国');
    assert.equal(countryName(' CN '), '接口中文名称');
    assert.equal(countryName('DE'), 'Germany');
    assert.equal(countryName('FR'), 'FR');
    assert.equal(countryName('JP'), 'JP');
    assert.equal(countryName(null), '未提供');
    assert.equal(countryName(undefined), '未提供');
    assert.equal(countryName(' '), '未提供');
    assert.equal(getMediaImageMetadata({file_path: '/a.jpg', iso_639_1: 'en'}, countries)[0].value, '未提供');
});

test('电影与同编号电视剧使用不同相册路径，不传图片语言筛选', () => {
    assert.equal(getMediaImagesPath('movie', 12), '/movie/12/images');
    assert.equal(getMediaImagesPath('tv', 12), '/tv/12/images');
    for (const id of [0, -1, 1.1, NaN, Infinity, '12']) {
        assert.throws(() => getMediaImagesPath('movie', id), /无效/);
    }
    assert.throws(() => getMediaImagesPath('person', 12), /无效/);
});

test('相册保留顺序、全部语言及元数据，每种分类独立去重且不截断为十张', () => {
    const photos = Object.freeze(Array.from({length: 12}, (_, i) => Object.freeze({
        file_path: `/image${i}.jpg`, width: 1920, height: 1080, aspect_ratio: 1.78,
        iso_639_1: i % 2 ? 'zh' : null, vote_average: 7, vote_count: 1,
    })));
    const data = Object.freeze({id: 12, backdrops: Object.freeze([...photos, photos[0]]), posters: photos, logos: []});
    const result = normalizeMediaImages(data);
    assert.deepEqual(result, {id: 12, backdrops: photos, posters: photos});
    assert.equal(result.backdrops.length, 12);
    assert.equal(result.backdrops[0], photos[0]);
    assert.equal(data.backdrops.length, 13);
});

test('忽略空图片和外部地址，空相册保持为空，异常响应可交给页面重试', () => {
    const invalid = [null, {}, {file_path: ''}, {file_path: '//outside/a.jpg'}, {file_path: 'https://outside/a.jpg'}];
    assert.deepEqual(normalizeMediaImages({id: 1, backdrops: invalid, posters: []}), {
        id: 1,
        backdrops: [],
        posters: []
    });
    for (const data of [null, {}, {backdrops: [], posters: null}, {backdrops: {}, posters: []}]) {
        assert.throws(() => normalizeMediaImages(data), /格式错误/);
    }
});

test('当前主图置顶并保留元数据；没有列表时使用主图兜底，不修改原列表', () => {
    const photos = Object.freeze([{file_path: '/a.jpg'}, {file_path: '/b.jpg', width: 500}]);
    assert.deepEqual(withCurrentMediaImage(photos, '/b.jpg'), [photos[1], photos[0]]);
    assert.deepEqual(withCurrentMediaImage([], '/main.jpg'), [{file_path: '/main.jpg'}]);
    assert.deepEqual(withCurrentMediaImage(photos, null), photos);
    assert.deepEqual(withCurrentMediaImage([], '//bad/image.jpg'), []);
    assert.equal(photos[0].file_path, '/a.jpg');
});
