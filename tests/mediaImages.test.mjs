import assert from 'node:assert/strict';
import test from 'node:test';
import {getMediaImagesPath, normalizeMediaImages, withCurrentMediaImage} from '../src/utils/mediaImages.ts';

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
