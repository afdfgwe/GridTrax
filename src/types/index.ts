// TMDB Types
export interface TMDBSearchResult {
  id: number;
  media_type: 'tv' | 'movie' | 'person';
  name?: string;
  title?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  first_air_date?: string;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date: string;
  vote_average: number;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TMDBSeasonSummary[];
  genres: { id: number; name: string }[];
  status: string;
}

export interface TMDBSeasonSummary {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path?: string;
  air_date?: string;
  episode_count: number;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path?: string;
  air_date?: string;
  episodes: TMDBEpisode[];
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date: string;
  vote_average: number;
  runtime?: number;
  genres: { id: number; name: string }[];
  status: string;
}

// Progress Store Types
export type WatchStatus = 'Wish' | 'Do' | 'Collect' | 'OnHold' | 'Dropped';

export interface EpisodeRecord {
  watched: boolean;
  comment: string;
}

export interface SeasonRecord {
  type: 'tv_season';
  tmdb_id: number;
  season_number: number;
  name?: string;
  show_name?: string;
  poster_path?: string;
  episode_count?: number;
  bangumi_subject_id?: number;
  bangumi_episode_ids?: Record<string, number>; // sort_number → bangumi_episode_id
  /** true = already searched Bangumi; false/undefined = new, not yet scanned */
  bangumi_scanned?: boolean;
  global_status?: WatchStatus;
  rating: number; // 0-10
  global_comment: string;
  episodes: Record<string, EpisodeRecord>;
  /** Unix ms timestamp of last user interaction (status/episode/rating change) */
  last_interacted?: number;
}

export interface MovieRecord {
  type: 'movie';
  tmdb_id: number;
  name?: string;
  poster_path?: string;
  global_status?: WatchStatus;
  rating: number;
  global_comment: string;
  /** Unix ms timestamp of last user interaction */
  last_interacted?: number;
}

export type ProgressRecord = SeasonRecord | MovieRecord;

export interface ProgressData {
  user_id: string;
  last_sync: number;
  tmdb_api_key?: string;
  records: Record<string, ProgressRecord>;
}

export interface SyncPayload {
  metadata: {
    version: number;
    exported_at: string;
  };
  progressData: ProgressData;
  bangumi?: {
    token: string;
    username: string;
    userId: number | null;
    nickname: string;
    lastSyncAt: number | null;
    autoSyncEnabled: boolean;
  };
  settings?: {
    tmdbApiKey: string;
  };
}

// UI helper
export const STATUS_LABELS: Record<WatchStatus, string> = {
  Wish: '想看',
  Do: '在看',
  Collect: '看过',
  OnHold: '搁置',
  Dropped: '抛弃',
};

export const STATUS_COLORS: Record<WatchStatus, string> = {
  Wish: '#6750A4',
  Do: '#0061A4',
  Collect: '#006E2C',
  OnHold: '#7E5700',
  Dropped: '#BA1A1A',
};

/** Sorting modes for home page */
export type SortMode = 'recent' | 'name' | 'rating';
