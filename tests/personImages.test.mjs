import test from 'node:test';
import assert from 'node:assert/strict';
import {getPersonPhotos, clampPhotoPan} from '../src/utils/personImages.ts';

test('人物相册当前头像置顶并去重，保留后续照片顺序，不修改接口数据', () => {
    const profiles = [{file_path: '/b.jpg'}, {file_path: '/a.jpg'}, {file_path: '/b.jpg'}, {file_path: '/c.png'}];
    const before = structuredClone(profiles);
    assert.deepEqual(getPersonPhotos('/a.jpg', profiles).map(p => p.file_path), ['/a.jpg', '/b.jpg', '/c.png']);
    assert.deepEqual(profiles, before);
});

test('人物相册忽略无效路径，空相册仍保留当前头像', () => {
    assert.deepEqual(getPersonPhotos('/a.jpg').map(p => p.file_path), ['/a.jpg']);
    assert.deepEqual(getPersonPhotos('', [null, {}, {file_path: ''}, {file_path: '//example.com/a.jpg'},
        {file_path: 'https://example.com/a.jpg'}, {file_path: '/../../a.jpg'}, {file_path: '/ok.jpg'}]), [{file_path: '/ok.jpg'}]);
});

test('缩放拖拽按图片适配尺寸限制边界，原始比例和未知尺寸不能拖出画布', () => {
    const viewport = {width: 600, height: 600};
    const image = {width: 400, height: 600};
    assert.deepEqual(clampPhotoPan(999, -999, 2, viewport, image), {x: 100, y: -300});
    assert.deepEqual(clampPhotoPan(40, 50, 1, viewport, image), {x: 0, y: 0});
    assert.deepEqual(clampPhotoPan(40, 50, 3, {width: 0, height: 0}, image), {x: 0, y: 0});
});
