import type {TMDBEpisode} from '../types';

/** 提取有实际内容的短标题，供悬停提示、标题列表和视图切换按钮共用。 */
export function getEpisodeTitle(episode: Pick<TMDBEpisode, 'name'>): string {
    const title = episode.name?.trim() ?? '';
    // 将全角字符等规范化后识别纯数字、“第几集”和英文占位名；这些不算短标题。
    // 规范化只用于判定，有效标题仍返回去除首尾空白后的原文。
    const normalized = title.normalize('NFKC');
    if (/^(?:第\s*[\d零〇一二三四五六七八九十百两]+\s*[集话話]|(?:episode|ep\.?)\s*\d+|\d+)$/i.test(normalized)) {
        return '';
    }
    return title;
}
