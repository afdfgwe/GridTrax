import type {TMDBCountry, TMDBMediaImage, TMDBMediaImages} from '../types/index.ts';
import {discoveryLanguageLabel} from './movieDiscovery.ts';

export type MediaImageKind = 'backdrops' | 'posters';

function imageCountryCode(photo: TMDBMediaImage): string {
    return photo.iso_3166_1?.trim().toUpperCase() || '';
}

function imageCountryName(code: string, countries: readonly TMDBCountry[]): string {
    const country = code ? countries.find(item => item.iso_3166_1.trim().toUpperCase() === code) : undefined;
    // 复用接口中文地区字典；加载失败或未匹配时保留图片自身的国家代码。
    return country?.native_name?.trim() || country?.english_name?.trim() || code || '未提供';
}

/** 按相册出现顺序列出国家；缺少国家信息的图片单独归类，不根据语言推断。 */
export function getMediaImageCountries(photos: readonly TMDBMediaImage[], countries: readonly TMDBCountry[] = []): { code: string; name: string }[] {
    return [...new Set(photos.map(imageCountryCode))].map(code => ({
        code, name: code ? imageCountryName(code, countries) : '未提供国家',
    }));
}

/** 星号表示全部国家，空字符串表示国家未提供；保留原有图片顺序。 */
export function filterMediaImagesByCountry(photos: readonly TMDBMediaImage[], code: string): readonly TMDBMediaImage[] {
    if (code === '*') return photos;
    return photos.filter(photo => imageCountryCode(photo) === code.trim().toUpperCase());
}

/** 图片语言不等于发行国家；不根据语言或影片产地推测图片国家。 */
export function getMediaImageMetadata(photo: TMDBMediaImage, countries: readonly TMDBCountry[] = []): { label: string; value: string }[] {
    const countryName = imageCountryName(imageCountryCode(photo), countries);
    const language = photo.iso_639_1?.trim().toLowerCase();
    const dimension = (value: number | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : '未提供';
    const width = dimension(photo.width);
    const height = dimension(photo.height);
    return [
        {label: '国家', value: countryName},
        {label: '语言', value: language ? discoveryLanguageLabel(language) : photo.iso_639_1 === null ? '无语言' : '未提供'},
        {label: '尺寸', value: width === '未提供' && height === '未提供' ? '未提供' : `${width} × ${height}`},
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
