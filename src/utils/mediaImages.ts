import type {TMDBMediaImage, TMDBMediaImages} from '../types/index.ts';
import {discoveryLanguageLabel} from './movieDiscovery.ts';

export type MediaImageKind = 'backdrops' | 'posters';

/** 图片语言不等于发行国家；不根据语言或影片产地推测图片国家。 */
export function getMediaImageMetadata(photo: TMDBMediaImage): { label: string; value: string }[] {
    const code = photo.iso_3166_1?.trim().toUpperCase();
    let country = code || '未提供';
    if (code && /^[A-Z]{2}$/.test(code)) {
        try {
            country = new Intl.DisplayNames(['zh-CN'], {type: 'region'}).of(code) || code;
        } catch {
            // 浏览器不支持地区本地化时保留接口代码。
        }
    }
    const language = photo.iso_639_1?.trim().toLowerCase();
    const dimension = (value: number | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? `${value} px` : '未提供';
    return [
        {label: '国家', value: country},
        {label: '语言', value: language ? discoveryLanguageLabel(language) : photo.iso_639_1 === null ? '无语言' : '未提供'},
        {label: '宽度', value: dimension(photo.width)},
        {label: '高度', value: dimension(photo.height)},
    ];
}

/** 图片请求不带语言过滤，保留全部横图和各语言版本海报。 */
export function getMediaImagesPath(mediaType: 'movie' | 'tv', mediaId: number): string {
    if (!['movie', 'tv'].includes(mediaType) || !Number.isSafeInteger(mediaId) || mediaId <= 0) {
        throw new Error('影视相册编号或类型无效');
    }
    return `/${mediaType}/${mediaId}/images`;
}

function validPath(path: unknown): path is string {
    return typeof path === 'string' && /^\/[\w.-]+$/.test(path);
}

/** 保留接口顺序和图片元数据，只排除异常路径及同一分类里的重复项。 */
function normalizePhotos(photos: readonly TMDBMediaImage[]): TMDBMediaImage[] {
    const seen = new Set<string>();
    return photos.filter(photo => {
        if (!validPath(photo?.file_path) || seen.has(photo.file_path)) return false;
        seen.add(photo.file_path);
        return true;
    });
}

export function normalizeMediaImages(data: TMDBMediaImages): TMDBMediaImages {
    if (!data || !Array.isArray(data.backdrops) || !Array.isArray(data.posters)) {
        throw new Error('影视相册格式错误');
    }
    return {id: data.id, backdrops: normalizePhotos(data.backdrops), posters: normalizePhotos(data.posters)};
}

/** 大图查看时把当前主图置顶；接口失败或列表为空时仍可查看已有图片。 */
export function withCurrentMediaImage(photos: readonly TMDBMediaImage[], path?: string | null): TMDBMediaImage[] {
    if (!validPath(path)) return [...photos];
    const current = photos.find(photo => photo.file_path === path) ?? {file_path: path};
    return [current, ...photos.filter(photo => photo.file_path !== path)];
}
