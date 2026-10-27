/**
 * 项目共用的数据契约。
 * TMDB 类型保留接口字段名；本地观影记录另行定义，不能把用户评分与接口评分混用。
 */
/** TMDB 类型字典，电影和电视剧的 genre_ids 通过 id 对应本地化名称。 */
export interface TMDBGenre {
    id: number;
    name: string;
}

/** TMDB 地区字典，请求中文版本后使用 native_name 显示地区名称。 */
export interface TMDBCountry {
    iso_3166_1: string;
    english_name: string;
    native_name?: string;
}

// TMDB 多类型搜索结果：电视剧、人物使用 name，电影使用 title。
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
    original_name?: string;
    profile_path?: string | null;
    known_for_department?: string;
    known_for?: {
        id: number;
        media_type: 'movie' | 'tv';
        title?: string;
        name?: string;
    }[];
}

/** 合集搜索没有影片类型、上映年份或评分，不混入影视详情使用的搜索类型。 */
export interface TMDBCollectionSearchResult {
    id: number;
    name: string;
    original_name?: string;
    original_language?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
}

/** 综合搜索与合集搜索共用页码，各自保留独立的总页数。 */
export interface TMDBSearchPage<T> {
    page: number;
    total_pages: number;
    results: T[];
}

/** 人物个人资料；未知日期、出生地和外链常以 null 或空字符串返回。 */
export interface TMDBPerson {
    id: number;
    name: string;
    adult?: boolean;
    also_known_as?: string[] | null;
    biography?: string | null;
    birthday?: string | null;
    deathday?: string | null;
    gender?: number;
    homepage?: string | null;
    imdb_id?: string | null;
    known_for_department?: string | null;
    place_of_birth?: string | null;
    popularity?: number;
    profile_path?: string | null;
}

/** 人物相册不按语言过滤，避免遗漏未标注语言的肖像。 */
export interface TMDBPersonImage {
    file_path: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
}

export interface TMDBPersonImages {
    id: number;
    profiles: TMDBPersonImage[];
}

/** 影视图片沿用 TMDB 字段；语言为空通常表示图片不含文字。 */
export interface TMDBMediaImage extends TMDBPersonImage {
    iso_639_1?: string | null;
    iso_3166_1?: string | null;
    vote_average?: number;
    vote_count?: number;
}

/** 这里只展示横图和海报，不把透明 Logo 混入相册。 */
export interface TMDBMediaImages {
    id: number;
    backdrops: TMDBMediaImage[];
    posters: TMDBMediaImage[];
}

/** 人物影视履历共用作品字段，电影与电视剧分别使用自己的片名和日期。 */
export interface TMDBPersonCredit {
    id: number;
    media_type: 'movie' | 'tv';
    title?: string;
    original_title?: string;
    name?: string;
    original_name?: string;
    poster_path?: string | null;
    release_date?: string | null;
    first_air_date?: string | null;
    vote_average?: number;
    credit_id?: string;
}

/** 同一作品可能既有出演记录，也有多条幕后职务，展示时按类型和编号合并。 */
export interface TMDBPersonCombinedCredits {
    id: number;
    cast: Array<TMDBPersonCredit & { character?: string | null }>;
    crew: Array<TMDBPersonCredit & { job?: string | null; department?: string | null }>;
}

/** 推荐和相似电视剧共用条目字段，无需逐部请求详情。 */
export interface TMDBTVRecommendation {
    id: number;
    name: string;
    original_name?: string;
    poster_path?: string | null;
    first_air_date?: string | null;
    vote_average?: number;
}

/** 推荐和相似接口均返回分页结构，页面只展示第一页的前十部。 */
export interface TMDBTVRecommendations {
    page: number;
    results: TMDBTVRecommendation[];
    total_pages: number;
    total_results: number;
}

/** 电影推荐使用片名和上映日期，不能与电视剧的 name、first_air_date 混用。 */
export interface TMDBMovieRecommendation {
    id: number;
    title: string;
    original_title?: string;
    poster_path?: string | null;
    release_date?: string | null;
    vote_average?: number;
    overview?: string;
    /** 合集成员及推荐影片的类型编号，通过电影类型字典转换为中文名称。 */
    genre_ids?: number[];
}

export interface TMDBMovieRecommendations {
    page: number;
    results: TMDBMovieRecommendation[];
    total_pages: number;
    total_results: number;
}

/** 电影所属合集的摘要来自电影详情，完整系列影片另行按合集编号获取。 */
export interface TMDBCollectionSummary {
    id: number;
    name: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
}

export interface TMDBCollection extends TMDBCollectionSummary {
    original_name?: string;
    overview?: string;
    parts: TMDBMovieRecommendation[];
}

/** 整部电视剧的详情，seasons 仅包含各季摘要，不包含每一集的完整信息。 */
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
    spoken_languages?: TMDBSpokenLanguage[] | null;
    production_countries?: TMDBProductionCountry[] | null;
    production_companies?: TMDBProductionCompany[] | null;
    networks?: TMDBNetwork[] | null;
}

/** 电视剧详情中的季摘要，用于本季介绍、海报、首播日期和评分展示。 */
export interface TMDBSeasonSummary {
    id: number;
    season_number: number;
    name: string;
    overview: string;
    poster_path?: string;
    air_date?: string;
    episode_count: number;
    vote_average?: number;
}

/** 单季详情，通过单独的季接口取得，episodes 用于集数展示和进度统计。 */
export interface TMDBSeason {
    id: number;
    season_number: number;
    name: string;
    overview: string;
    poster_path?: string;
    air_date?: string;
    episodes: TMDBEpisode[];
}

/** 单集信息；name 可能是真实短标题，也可能只是“第 1 集”等占位名称。 */
export interface TMDBEpisode {
    id: number;
    episode_number: number;
    season_number: number;
    name: string;
    overview?: string | null;
    still_path?: string;
    air_date?: string | null;
    runtime?: number | null;
    vote_average?: number;
}

/** 电影、电视剧使用的语言，优先展示接口提供的本地名称。 */
export interface TMDBSpokenLanguage {
    english_name: string;
    iso_639_1: string;
    name: string;
}

/** 电影、电视剧的制片地区，中文名称通过 iso_3166_1 匹配地区字典。 */
export interface TMDBProductionCountry {
    iso_3166_1: string;
    name: string;
}

/** 出品公司仅展示 Logo，名称用于图片描述与悬停提示。 */
export interface TMDBProductionCompany {
    id: number;
    name: string;
    logo_path?: string | null;
    origin_country?: string;
}

/** 电视剧的播出平台，Logo 接在出品公司之后，名称用于图片描述与悬停提示。 */
export interface TMDBNetwork {
    id: number;
    name: string;
    logo_path?: string | null;
    origin_country?: string;
}

/** 电影详情；release_date 提供年份，vote_average 是海报上展示的 TMDB 评分。 */
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
    spoken_languages?: TMDBSpokenLanguage[] | null;
    production_countries?: TMDBProductionCountry[] | null;
    production_companies?: TMDBProductionCompany[] | null;
    belongs_to_collection?: TMDBCollectionSummary | null;
}

/** 演职员的公共人物资料；头像缺失时使用人物占位图标。 */
export interface TMDBCreditPerson {
    id: number;
    name: string;
    original_name?: string;
    profile_path?: string | null;
}

export interface TMDBCastMember extends TMDBCreditPerson {
    character?: string; // 角色名，同一演员的多个角色由展示层合并。
    order?: number; // 演职员表排序，缺失时排在最后。
    credit_id?: string;
}

export interface TMDBCrewMember extends TMDBCreditPerson {
    job: string;
    department?: string;
    credit_id?: string;
}

/** 电影和电视剧共用的演职员展示数据，不写入本地观影记录。 */
export interface TMDBCredits {
    id: number;
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
}

/** 电视剧整剧汇总接口，同一人物可能拥有多个角色或幕后职务。 */
export interface TMDBTVAggregateCredits {
    id: number;
    cast: Array<TMDBCreditPerson & {
        order?: number;
        roles?: Array<{ character?: string; credit_id?: string; episode_count?: number }> | null;
    }>;
    crew: Array<TMDBCreditPerson & {
        department?: string;
        jobs?: Array<{ job: string; credit_id?: string; episode_count?: number }> | null;
    }>;
}

// 本地观影记录：状态代码也是备份文件的字段值，修改时需要考虑旧备份兼容性。
// 依次对应想看、在看、看过、搁置、抛弃，界面文案统一取下方 STATUS_LABELS。
export type WatchStatus = 'Wish' | 'Do' | 'Collect' | 'OnHold' | 'Dropped';

export interface EpisodeRecord {
    watched: boolean;
    /** 历史吐槽字段，当前没有编辑入口，保留以兼容已有记录和备份。 */
    comment: string;
}

/** 电视剧按季追踪：同一部剧的不同季拥有不同记录和观看状态。 */
export interface SeasonRecord {
    type: 'tv_season';
    tmdb_id: number;
    season_number: number;
    name?: string; // 季名称，来自电视剧详情中的 seasons[].name。
    show_name?: string; // 整部剧的名称，供追踪卡片标题使用。
    poster_path?: string;
    episode_count?: number;
    global_status?: WatchStatus; // 未设置状态的记录不会出现在追踪面板中。
    rating: number; // 历史用户评分（0 到 10），不是 TMDB 评分，保留用于备份兼容。
    global_comment: string; // 历史吐槽字段，导入导出时仍保留。
    episodes: Record<string, EpisodeRecord>; // 键为集号字符串，不是 TMDB 单集 ID。
    /** 最近一次状态或集数操作的毫秒时间戳，不是完整操作历史。 */
    last_interacted?: number;
}

/** 电影按整部追踪，不包含季号和单集记录。 */
export interface MovieRecord {
    type: 'movie';
    tmdb_id: number;
    name?: string;
    poster_path?: string;
    global_status?: WatchStatus;
    rating: number; // 历史用户评分字段，当前页面不再提供编辑入口。
    global_comment: string; // 历史吐槽字段，导入导出时仍保留。
    /** 最近一次用户操作的毫秒时间戳，用于“最近互动”排序。 */
    last_interacted?: number;
}

/** 使用 type 区分电影与电视剧季，访问季专属字段前应先判断类型。 */
export type ProgressRecord = SeasonRecord | MovieRecord;

/** 持久化与导入导出共用的观影数据，不包含主题偏好、接口缓存或临时分页状态。 */
export interface ProgressData {
    user_id: string; // 本地数据标识，当前并非在线账号。
    last_sync: number; // 沿用旧版时间字段，当前项目不执行云同步。
    records: Record<string, ProgressRecord>; // 键为 tmdb_movie_ID 或 tmdb_tv_ID_s季号。
}

/** JSON 备份的外层格式，版本号用于识别可兼容的数据结构。 */
export interface BackupPayload {
    metadata: {
        version: number;
        exported_at: string;
    };
    progressData: ProgressData;
}

// 状态代码到中文名称、颜色的映射，避免页面各自维护不同含义。
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

/** 追踪面板的排序方式：最近互动、名称、TMDB 评分。 */
export type SortMode = 'recent' | 'name' | 'rating';
