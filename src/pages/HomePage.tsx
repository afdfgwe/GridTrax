import SortIcon from '@mui/icons-material/Sort';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CardMedia,
    Container,
    Grid,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    Typography
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {navigationMemory} from '../utils/navigationMemory';
import {getPosterUrl} from '../api/tmdb';
import HomeActiveCard from '../components/HomeActiveCard';
import HomeMovieActiveCard from '../components/HomeMovieActiveCard';
import PosterScoreBadge from '../components/PosterScoreBadge';
import CompactCardTitle from '../components/CompactCardTitle';
import WatchedTimeline from '../components/WatchedTimeline';
import WatchedViewToggle from '../components/WatchedViewToggle';
import {useHomeMediaDetails} from '../hooks/useHomeMediaDetails';
import {getMediaYearKey} from '../utils/mediaYears';
import {useProgressStore} from '../store/useProgressStore';
import {
    STATUS_LABELS,
    type MovieRecord,
    type ProgressRecord,
    type SeasonRecord,
    type SortMode,
    type WatchStatus
} from '../types';

// 排序工具：中文名称使用自然数字排序，例如“第 2 季”排在“第 10 季”之前。

const zhCollator = new Intl.Collator('zh-Hans-CN', {sensitivity: 'base', numeric: true});

const SORT_LABELS: Record<SortMode, string> = {
    recent: '最近互动',
    name: '名称',
    rating: '评分',
};

type MediaFilter = 'all' | ProgressRecord['type'];

const FILTER_LABELS: Record<MediaFilter, string> = {
    all: '全部',
    tv_season: '电视剧',
    movie: '电影',
};

// 电视剧优先按整部剧名排序，而不是按单季名称排序。
const getRecordName = (r: ProgressRecord): string => {
    if (r.type === 'tv_season') {
        return (r as SeasonRecord).show_name || r.name || '';
    }
    return r.name || '';
};

/** 返回排序副本，不改动存储中的数组；同分时优先最近互动的作品。 */
const sortRecords = (items: ProgressRecord[], mode: SortMode, scores: Record<string, number>): ProgressRecord[] => {
    const sorted = [...items];
    switch (mode) {
        case 'recent':
            sorted.sort((a, b) => (b.last_interacted ?? 0) - (a.last_interacted ?? 0));
            break;
        case 'name':
            sorted.sort((a, b) => zhCollator.compare(getRecordName(a), getRecordName(b)));
            break;
        case 'rating':
            sorted.sort((a, b) =>
                (scores[`${b.type}-${b.tmdb_id}`] ?? 0) - (scores[`${a.type}-${a.tmdb_id}`] ?? 0)
                || (b.last_interacted ?? 0) - (a.last_interacted ?? 0)
            );
            break;
    }
    return sorted;
};

// 各板块独立保存排序和类型筛选；看过时间线不使用网格的筛选偏好。

const STORAGE_PREFIX = 'gridtrax-sort-';
const FILTER_STORAGE_PREFIX = 'gridtrax-media-filter-';
const ALL_STATUSES: WatchStatus[] = ['Do', 'Wish', 'Collect', 'OnHold', 'Dropped'];
const WATCHED_VIEW_STORAGE_KEY = 'gridtrax-watched-view';
type WatchedView = 'grid' | 'timeline';
// 仅用于影片网格；在看卡片和看过时间线不做影片分页。
const FILMS_PER_PAGE = 15;

const getWatchedView = (): WatchedView => {
    try {
        if (localStorage.getItem(WATCHED_VIEW_STORAGE_KEY) === 'grid') return 'grid';
    } catch { /* 无法读取偏好时沿用时间线，仍可在当前页面切换。 */
    }
    return 'timeline';
};

const getSectionSortMode = (status: WatchStatus): SortMode => {
    try {
        const stored = localStorage.getItem(STORAGE_PREFIX + status);
        if (stored === 'recent' || stored === 'name' || stored === 'rating') return stored;
    } catch { /* 浏览器限制存储访问时使用默认排序，不阻断页面。 */
    }
    return 'recent';
};

const saveSectionSortMode = (status: WatchStatus, mode: SortMode) => {
    try {
        localStorage.setItem(STORAGE_PREFIX + status, mode);
    } catch { /* 写入失败只影响下次访问，当前组件状态仍然生效。 */
    }
};

const getSectionMediaFilter = (status: WatchStatus): MediaFilter => {
    try {
        const stored = localStorage.getItem(FILTER_STORAGE_PREFIX + status);
        if (stored === 'tv_season' || stored === 'movie') return stored;
    } catch { /* 无法读取偏好时回退为全部类型。 */
    }
    return 'all';
};

const saveSectionMediaFilter = (status: WatchStatus, filter: MediaFilter) => {
    try {
        localStorage.setItem(FILTER_STORAGE_PREFIX + status, filter);
    } catch { /* 偏好保存失败不影响本次筛选。 */
    }
};

// 菜单只管理自己的锚点，实际排序和筛选值由首页维护。

interface SectionSortButtonProps {
    sortMode: SortMode;
    onSortChange: (mode: SortMode) => void;
    primary: string;
}

const SectionSortButton: React.FC<SectionSortButtonProps> = ({sortMode, onSortChange, primary}) => {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);
    return (
        <>
            <IconButton
                size="small"
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    color: 'text.secondary',
                    border: `1px solid ${alpha(primary, 0.15)}`,
                    borderRadius: 1.5,
                    px: 1,
                    py: 0.25,
                    gap: 0.4,
                    ml: 1,
                }}
            >
                <SortIcon sx={{fontSize: 16}}/>
                <Typography variant="caption" fontSize="0.7rem" fontWeight={600}>{SORT_LABELS[sortMode]}</Typography>
            </IconButton>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                slotProps={{paper: {sx: {borderRadius: 2, minWidth: 130}}}}
            >
                {(['recent', 'name', 'rating'] as SortMode[]).map((mode) => (
                    <MenuItem
                        key={mode}
                        selected={sortMode === mode}
                        onClick={() => {
                            onSortChange(mode);
                            setAnchor(null);
                        }}
                        sx={{fontSize: '0.85rem', fontWeight: sortMode === mode ? 700 : 400}}
                    >
                        {SORT_LABELS[mode]}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

interface SectionMediaFilterButtonProps {
    filter: MediaFilter;
    onFilterChange: (filter: MediaFilter) => void;
    primary: string;
}

const SectionMediaFilterButton: React.FC<SectionMediaFilterButtonProps> = ({filter, onFilterChange, primary}) => {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);
    return (
        <>
            <IconButton
                size="small"
                aria-label={`影片类型：${FILTER_LABELS[filter]}`}
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    color: 'text.secondary',
                    border: `1px solid ${alpha(primary, 0.15)}`,
                    borderRadius: 1.5,
                    px: 1,
                    py: 0.25,
                    gap: 0.4,
                    ml: 1,
                }}
            >
                <SortIcon sx={{fontSize: 16}}/>
                <Typography variant="caption" fontSize="0.7rem" fontWeight={600}>{FILTER_LABELS[filter]}</Typography>
            </IconButton>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                slotProps={{paper: {sx: {borderRadius: 2, minWidth: 130}}}}
            >
                {(['all', 'tv_season', 'movie'] as MediaFilter[]).map((option) => (
                    <MenuItem
                        key={option}
                        selected={filter === option}
                        onClick={() => {
                            onFilterChange(option);
                            setAnchor(null);
                        }}
                        sx={{fontSize: '0.85rem', fontWeight: filter === option ? 700 : 400}}
                    >
                        {FILTER_LABELS[option]}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

/** 看过可切换网格与时间线；时间线使用全部记录，网格沿用筛选和分页。 */

const HomePage: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const records = useProgressStore((state) => state.data.records);
    const primary = theme.palette.primary.main;

    // 惰性初始化各板块偏好，避免每次渲染都读取浏览器存储。
    const [sortModes, setSortModes] = useState<Record<WatchStatus, SortMode>>(() => {
        const init = {} as Record<WatchStatus, SortMode>;
        for (const s of ALL_STATUSES) init[s] = getSectionSortMode(s);
        return init;
    });

    const [mediaFilters, setMediaFilters] = useState<Record<WatchStatus, MediaFilter>>(() => {
        const init = {} as Record<WatchStatus, MediaFilter>;
        for (const s of ALL_STATUSES) init[s] = getSectionMediaFilter(s);
        return init;
    });

    // 每条历史记录独立记住网格页码，详情返回时恢复；不写入观看数据或永久偏好。
    const [sectionPages, setSectionPages] = useState<Record<WatchStatus, number>>(() => ({
        Do: 0, Wish: 0, Collect: 0, OnHold: 0, Dropped: 0,
        ...navigationMemory.get(location.key)?.pages,
    }));
    useEffect(() => {
        navigationMemory.set(location.key, {pages: sectionPages});
    }, [location.key, sectionPages]);

    const [watchedView, setWatchedView] = useState<WatchedView>(getWatchedView);
    const handleWatchedViewChange = (view: WatchedView) => {
        setWatchedView(view);
        try {
            localStorage.setItem(WATCHED_VIEW_STORAGE_KEY, view);
        } catch { /* 写入失败不影响当前切换，也不修改观看记录。 */
        }
    };
    const watchedViewToggle = <WatchedViewToggle view={watchedView} onChange={handleWatchedViewChange}/>;

    const handleSortChange = useCallback((status: WatchStatus, mode: SortMode) => {
        setSortModes((prev) => ({...prev, [status]: mode}));
        setSectionPages((prev) => ({...prev, [status]: 0}));
        saveSectionSortMode(status, mode);
    }, []);

    const handleMediaFilterChange = useCallback((status: WatchStatus, filter: MediaFilter) => {
        setMediaFilters((prev) => ({...prev, [status]: filter}));
        setSectionPages((prev) => ({...prev, [status]: 0}));
        saveSectionMediaFilter(status, filter);
    }, []);

    // 浏览详情可能仅生成元数据记录，没有明确观看状态的记录不进入追踪面板。
    const trackedItems = useMemo(() => {
        return Object.values(records).filter((record) => record.global_status);
    }, [records]);

    const {scores, years, failedCount, retry} = useHomeMediaDetails(trackedItems);

    const itemsByStatus = useMemo(() => {
        const groups: Record<WatchStatus, (SeasonRecord | MovieRecord)[]> = {
            Do: [], Wish: [], Collect: [], OnHold: [], Dropped: [],
        };
        trackedItems.forEach((item) => {
            if (item.global_status) groups[item.global_status].push(item);
        });
        // 各组使用自己的排序方式；评分来自详情接口，不是历史个人评分字段。
        for (const s of ALL_STATUSES) {
            groups[s] = sortRecords(groups[s], sortModes[s], scores) as (SeasonRecord | MovieRecord)[];
        }
        return groups;
    }, [trackedItems, sortModes, scores]);

    const visibleItemsByStatus = useMemo(() => {
        const groups = {...itemsByStatus};
        for (const status of ALL_STATUSES) {
            const filter = mediaFilters[status];
            groups[status] = filter === 'all'
                ? itemsByStatus[status]
                : itemsByStatus[status].filter((item) => item.type === filter);
        }
        return groups;
    }, [itemsByStatus, mediaFilters]);

    const handleCardClick = (record: SeasonRecord | MovieRecord) => {
        if (record.type === 'tv_season') {
            navigate(`/tv/${record.tmdb_id}`);
        } else {
            navigate(`/movie/${record.tmdb_id}`);
        }
    };

    // 紧凑卡片中整部剧名作为标题；季名仅用于标签，重复时回退为季号。
    const renderCompactCard = (record: SeasonRecord | MovieRecord) => {
        const isTv = record.type === 'tv_season';
        const tvRecord = isTv ? (record as SeasonRecord) : null;
        const titleText = isTv
            ? (tvRecord?.show_name || tvRecord?.name || `剧集 ID: ${record.tmdb_id}`)
            : (record.name || `电影 ID: ${record.tmdb_id}`);
        const tagText = isTv
            ? (tvRecord?.name && tvRecord.name !== titleText ? tvRecord.name : `第 ${tvRecord?.season_number} 季`)
            : '电影';
        const year = years[getMediaYearKey(record)];
        const key = `${record.type}-${record.tmdb_id}-${isTv ? tvRecord?.season_number : ''}`;

        return (
            // MUI 栅格按 12 份分配：手机每行 3 张，中屏 4 张，大屏 5 张。
            <Grid key={key} size={{xs: 4, sm: 3, lg: 2.4}}>
                <Card
                    sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'background.paper',
                        transition: 'transform 200ms ease, box-shadow 200ms ease',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        },
                    }}
                >
                    <CardActionArea
                        onClick={() => handleCardClick(record)}
                        sx={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}
                    >
                        <Box sx={{position: 'relative'}}>
                            {record.poster_path ? (
                                <CardMedia
                                    component="img"
                                    image={getPosterUrl(record.poster_path, 'w342')}
                                    alt={titleText}
                                    sx={{aspectRatio: '2/3', objectFit: 'cover', backgroundColor: alpha('#fff', 0.05)}}
                                />
                            ) : (
                                <Box sx={{
                                    aspectRatio: '2/3',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: alpha(primary, 0.1)
                                }}>
                                    <Typography variant="caption" color="primary">No Poster</Typography>
                                </Box>
                            )}
                            {/* 年份固定在海报左上角，深色半透明底保证不同海报和主题下可读。 */}
                            {year && (
                                <Typography
                                    component="span"
                                    variant="caption"
                                    sx={{
                                        position: 'absolute',
                                        top: 2,
                                        left: 2,
                                        px: 0.5,
                                        py: 0.25,
                                        borderRadius: 0.75,
                                        backgroundColor: 'rgba(0, 0, 0, 0.72)',
                                        color: '#fff',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        lineHeight: 1.25,
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {year}年
                                </Typography>
                            )}
                            {record.poster_path &&
                                <PosterScoreBadge score={scores[`${record.type}-${record.tmdb_id}`]}/>}
                        </Box>
                        <CardContent sx={{
                            flex: 1,
                            px: {xs: 1, sm: 1.5},
                            pt: {xs: 0.75, sm: 1.5},
                            pb: {xs: '6px !important', sm: '12px !important'},
                        }}>
                            <CompactCardTitle title={titleText}/>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: {xs: 0.5, sm: 0.75},
                                minWidth: 0,
                                mt: {xs: 0.25, sm: 0.5}
                            }}>
                                {isTv ? (
                                    <Typography
                                        component="span"
                                        noWrap
                                        title={tagText}
                                        sx={{
                                            minWidth: 0,
                                            backgroundColor: alpha(primary, 0.15),
                                            color: primary,
                                            px: {xs: 0.375, sm: 0.75},
                                            py: 0.25,
                                            borderRadius: 1,
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {tagText}
                                    </Typography>
                                ) : (
                                    <Typography component="span" variant="caption" color="text.secondary" noWrap
                                                title={tagText} sx={{minWidth: 0, fontSize: '0.75rem'}}>
                                        {tagText}
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </CardActionArea>
                </Card>
            </Grid>
        );
    };

    // 时间线以外的板块共享筛选标题；网格在行尾增加影片翻页入口。
    const renderSectionHeader = (status: WatchStatus, count: number) => {
        const totalPages = Math.max(Math.ceil(count / FILMS_PER_PAGE), 1);
        // 删除记录或减少筛选结果后收敛页码，空列表也保留一个有效页码用于展示。
        const currentPage = Math.min(sectionPages[status], totalPages - 1);
        const pageButtonSx = {
            color: 'text.secondary',
            border: `1px solid ${alpha(primary, 0.15)}`,
            borderRadius: 1.5,
            p: 0.5,
        };

        return (
            <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', rowGap: 1, mb: 2}}>
                <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        width: {xs: status === 'Do' || status === 'Collect' ? 'auto' : '100%', sm: 'auto'},
                        flexShrink: 0,
                        '&::before': {
                            content: '""',
                            width: 4,
                            height: 16,
                            backgroundColor: primary,
                            mr: 1,
                            borderRadius: 1
                        },
                    }}
                >
                    {STATUS_LABELS[status]} ({count})
                </Typography>
                {status === 'Collect' && (
                    <>
                        <Box sx={{ml: {xs: 'auto', sm: 1}, mr: {sm: 1}}}>{watchedViewToggle}</Box>
                        {/* 窄屏将网格工具放到下一行，标题和切换入口始终并排。 */}
                        <Box sx={{display: {xs: 'block', sm: 'none'}, flexBasis: '100%'}}/>
                    </>
                )}
                <SectionSortButton
                    sortMode={sortModes[status]}
                    onSortChange={(mode) => handleSortChange(status, mode)}
                    primary={primary}
                />
                <SectionMediaFilterButton
                    filter={mediaFilters[status]}
                    onFilterChange={(filter) => handleMediaFilterChange(status, filter)}
                    primary={primary}
                />
                {status !== 'Do' && (
                    <Box component="nav" aria-label={`${STATUS_LABELS[status]}分页`}
                         sx={{display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0}}>
                        <Tooltip title="上一页">
                        <span>
                            <IconButton
                                size="small"
                                aria-label={`${STATUS_LABELS[status]}上一页`}
                                disabled={currentPage === 0}
                                onClick={() => setSectionPages((prev) => ({...prev, [status]: currentPage - 1}))}
                                sx={pageButtonSx}
                            >
                                <ChevronLeftIcon sx={{fontSize: 16}}/>
                            </IconButton>
                        </span>
                        </Tooltip>
                        <Typography variant="caption" aria-live="polite" sx={{
                            color: 'text.secondary',
                            minWidth: 32,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                            {currentPage + 1}/{totalPages}
                        </Typography>
                        <Tooltip title="下一页">
                        <span>
                            <IconButton
                                size="small"
                                aria-label={`${STATUS_LABELS[status]}下一页`}
                                disabled={currentPage === totalPages - 1}
                                onClick={() => setSectionPages((prev) => ({...prev, [status]: currentPage + 1}))}
                                sx={pageButtonSx}
                            >
                                <ChevronRightIcon sx={{fontSize: 16}}/>
                            </IconButton>
                        </span>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{minHeight: '100vh'}}>
            <Container maxWidth="lg" sx={{pt: 2, pb: 6}}>
                {failedCount > 0 && <Alert severity="warning" sx={{mb: 2}} action={<Button size="small" color="inherit"
                                                                                           onClick={retry}>重试</Button>}>部分影片资料加载失败，海报、年份或评分可能暂不完整；观看记录不受影响。</Alert>}
                <Typography variant="h5" fontWeight={700} sx={{mb: 3}}>
                    正在追踪
                </Typography>

                {trackedItems.length === 0 ? (
                    <Box sx={{textAlign: 'center', py: 10}}>
                        <Typography variant="h6" color="text.secondary" sx={{mb: 2}}>
                            还没有追踪任何项目
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            在右上角搜索喜欢的影视作品开始追踪
                        </Typography>
                    </Box>
                ) : (
                    <Box>
                        {/* 在看使用全宽卡片；不做影片分页，电视剧卡片内部单独分页集数。 */}
                        {itemsByStatus.Do.length > 0 && (
                            <Box sx={{mb: 6}}>
                                {renderSectionHeader('Do', visibleItemsByStatus.Do.length)}
                                {visibleItemsByStatus.Do.length === 0 && (
                                    <Typography variant="body2" color="text.secondary">没有符合条件的影片</Typography>
                                )}
                                {visibleItemsByStatus.Do.map((record) => {
                                    if (record.type === 'tv_season') {
                                        return (
                                            <HomeActiveCard
                                                key={`do-tv-${record.tmdb_id}-${record.season_number}`}
                                                tvId={record.tmdb_id}
                                                seasonNumber={record.season_number}
                                                name={record.name}
                                                showName={(record as SeasonRecord).show_name}
                                                posterPath={record.poster_path}
                                                episodeCount={record.episode_count}
                                                score={scores[`tv_season-${record.tmdb_id}`]}
                                                year={years[getMediaYearKey(record)]}
                                            />
                                        );
                                    } else {
                                        const mvRecord = record as MovieRecord;
                                        return (
                                            <HomeMovieActiveCard
                                                key={`do-movie-${record.tmdb_id}`}
                                                movieId={record.tmdb_id}
                                                name={mvRecord.name}
                                                posterPath={mvRecord.poster_path}
                                                score={scores[`movie-${record.tmdb_id}`]}
                                                year={years[getMediaYearKey(record)]}
                                            />
                                        );
                                    }
                                })}
                            </Box>
                        )}

                        {/* 看过时间线展示全部记录；切回网格后恢复原筛选和页码。 */}
                        {(['Wish', 'Collect', 'OnHold', 'Dropped'] as const).map((status) => {
                            if (itemsByStatus[status].length === 0) return null;
                            if (status === 'Collect' && watchedView === 'timeline') return (
                                <WatchedTimeline key={status} records={itemsByStatus.Collect} scores={scores}
                                                 years={years} headerActions={watchedViewToggle}/>
                            );
                            const items = visibleItemsByStatus[status];
                            const totalPages = Math.max(Math.ceil(items.length / FILMS_PER_PAGE), 1);
                            const currentPage = Math.min(sectionPages[status], totalPages - 1);
                            const pageItems = items.slice(currentPage * FILMS_PER_PAGE, (currentPage + 1) * FILMS_PER_PAGE);

                            return (
                                <Box key={status} sx={{mb: 5}}>
                                    {renderSectionHeader(status, items.length)}
                                    {items.length === 0 && (
                                        <Typography variant="body2" color="text.secondary">没有符合条件的影片</Typography>
                                    )}
                                    <Grid container spacing={{xs: 1, sm: 2}}>
                                        {pageItems.map(renderCompactCard)}
                                    </Grid>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Container>
        </Box>
    );
};

export default HomePage;
