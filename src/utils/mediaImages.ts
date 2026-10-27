import type {TMDBMediaImage, TMDBMediaImages} from '../types/index.ts';

export type MediaImageKind = 'backdrops' | 'posters';

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
