import type { TMDBEpisode } from '../types';

export function getEpisodeTitle(episode: Pick<TMDBEpisode, 'name'>): string {
    const title = episode.name?.trim() ?? '';
    // Ignore number-only names and common TMDB placeholder episode names.
    const normalized = title.normalize('NFKC');
    if (/^(?:第\s*[\d零〇一二三四五六七八九十百两]+\s*[集话話]|(?:episode|ep\.?)\s*\d+|\d+)$/i.test(normalized)) {
        return '';
    }
    return title;
}
