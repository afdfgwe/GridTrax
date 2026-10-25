import type {TMDBPersonImage} from '../types/index.ts';

/** 当前头像置顶；只接收站内图片路径，忽略空值、异常值与重复照片。 */
export function getPersonPhotos(portrait: string, profiles: readonly TMDBPersonImage[] = []): TMDBPersonImage[] {
    const photos: TMDBPersonImage[] = [];
    const seen = new Set<string>();
    for (const photo of [{file_path: portrait}, ...profiles]) {
        const path = photo?.file_path;
        if (typeof path !== 'string' || !/^\/[\w.-]+$/.test(path) || seen.has(path)) continue;
        seen.add(path);
        photos.push(photo);
    }
    return photos;
}

/** 拖拽范围以图片实际适配后的大小计算，避免缩放后把整张照片移出视野。 */
export function clampPhotoPan(x: number, y: number, scale: number,
                              viewport: { width: number; height: number }, image: { width: number; height: number }) {
    if (!viewport.width || !viewport.height || !image.width || !image.height || scale <= 1) return {x: 0, y: 0};
    const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
    const limitX = Math.max(0, (image.width * fit * scale - viewport.width) / 2);
    const limitY = Math.max(0, (image.height * fit * scale - viewport.height) / 2);
    return {x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y))};
}
