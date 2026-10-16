import SortIcon from '@mui/icons-material/Sort';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
    Box,
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
import React, {useCallback, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import HomeActiveCard from '../components/HomeActiveCard';
import HomeMovieActiveCard from '../components/HomeMovieActiveCard';
import PosterScoreBadge from '../components/PosterScoreBadge';
import {useHomeMediaDetails} from '../hooks/useHomeMediaDetails';
import {useProgressStore} from '../store/useProgressStore';
import {
    STATUS_LABELS,
    type MovieRecord,
    type ProgressRecord,
    type SeasonRecord,
    type SortMode,
    type WatchStatus
} from '../types';

// ─── Sorting helpers ─────────────────────────────────────────

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

const getRecordName = (r: ProgressRecord): string => {
    if (r.type === 'tv_season') {
        return (r as SeasonRecord).show_name || r.name || '';
    }
    return r.name || '';
};

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

// ─── Per-section localStorage persistence ────────────────────

const STORAGE_PREFIX = 'gridtrax-sort-';
const FILTER_STORAGE_PREFIX = 'gridtrax-media-filter-';
const ALL_STATUSES: WatchStatus[] = ['Do', 'Wish', 'Collect', 'OnHold', 'Dropped'];
const FILMS_PER_PAGE = 15;

const getSectionSortMode = (status: WatchStatus): SortMode => {
    try {
        const stored = localStorage.getItem(STORAGE_PREFIX + status);
        if (stored === 'recent' || stored === 'name' || stored === 'rating') return stored;
    } catch { /* noop */
    }
    return 'recent';
};

const saveSectionSortMode = (status: WatchStatus, mode: SortMode) => {
    try {
        localStorage.setItem(STORAGE_PREFIX + status, mode);
    } catch { /* noop */
    }
};

const getSectionMediaFilter = (status: WatchStatus): MediaFilter => {
    try {
        const stored = localStorage.getItem(FILTER_STORAGE_PREFIX + status);
        if (stored === 'tv_season' || stored === 'movie') return stored;
    } catch { /* noop */
    }
    return 'all';
};

const saveSectionMediaFilter = (status: WatchStatus, filter: MediaFilter) => {
    try {
        localStorage.setItem(FILTER_STORAGE_PREFIX + status, filter);
    } catch { /* noop */
    }
};

// ─── SectionSortButton sub-component ─────────────────────────

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

// ─── HomePage ────────────────────────────────────────────────

const HomePage: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const records = useProgressStore((state) => state.data.records);
    const primary = theme.palette.primary.main;

    // Per-section sort modes
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

    const [sectionPages, setSectionPages] = useState<Record<WatchStatus, number>>({
        Do: 0, Wish: 0, Collect: 0, OnHold: 0, Dropped: 0,
    });

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

    const trackedItems = useMemo(() => {
        return Object.values(records).filter((record) => record.global_status);
    }, [records]);

    const {scores, years} = useHomeMediaDetails(trackedItems);

    const itemsByStatus = useMemo(() => {
        const groups: Record<WatchStatus, (SeasonRecord | MovieRecord)[]> = {
            Do: [], Wish: [], Collect: [], OnHold: [], Dropped: [],
        };
        trackedItems.forEach((item) => {
            if (item.global_status) groups[item.global_status].push(item);
        });
        // Sort each group with its own mode
        for (const s of ALL_STATUSES) {
            groups[s] = sortRecords(groups[s], sortModes[s], scores) as (SeasonRecord | MovieRecord)[];
        }
        return groups;
    }, [trackedItems, sortModes, scores]);

    const visibleItemsByStatus = useMemo(() => {
        const groups = {} as typeof itemsByStatus;
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

    const renderCompactCard = (record: SeasonRecord | MovieRecord) => {
        const isTv = record.type === 'tv_season';
        const tvRecord = isTv ? (record as SeasonRecord) : null;
        const titleText = isTv
            ? (tvRecord?.show_name || tvRecord?.name || `剧集 ID: ${record.tmdb_id}`)
            : (record.name || `电影 ID: ${record.tmdb_id}`);
        const tagText = isTv
            ? (tvRecord?.name && tvRecord.name !== titleText ? tvRecord.name : `第 ${tvRecord?.season_number} 季`)
            : '电影';
        const year = years[`${record.type}-${record.tmdb_id}`];
        const key = `${record.type}-${record.tmdb_id}-${isTv ? tvRecord?.season_number : ''}`;

        return (
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
                            {record.poster_path &&
                                <PosterScoreBadge score={scores[`${record.type}-${record.tmdb_id}`]}/>}
                        </Box>
                        <CardContent sx={{flex: 1, p: {xs: 1, sm: 1.5}, pb: '12px !important'}}>
                            <Typography variant="body2" fontWeight={700} noWrap title={titleText}>
                                {titleText}
                            </Typography>
                            <Box sx={{display: 'flex', alignItems: 'center', gap: {xs: 0.5, sm: 0.75}, minWidth: 0, mt: 0.5}}>
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
                                    <Typography component="span" variant="caption" color="text.secondary" noWrap title={tagText} sx={{minWidth: 0, fontSize: '0.75rem'}}>
                                        {tagText}
                                    </Typography>
                                )}
                                {year && <Typography component="span" variant="caption" color="text.secondary" sx={{flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.75rem'}}>{year}年</Typography>}
                            </Box>
                        </CardContent>
                    </CardActionArea>
                </Card>
            </Grid>
        );
    };

    // ─── Section header with sort and type filter ─────────────
    const renderSectionHeader = (status: WatchStatus, count: number) => {
        const totalPages = Math.max(Math.ceil(count / FILMS_PER_PAGE), 1);
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
                    width: {xs: status === 'Do' ? 'auto' : '100%', sm: 'auto'},
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
                <Box component="nav" aria-label={`${STATUS_LABELS[status]}分页`} sx={{display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0}}>
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
                    <Typography variant="caption" aria-live="polite" sx={{color: 'text.secondary', minWidth: 32, textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
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
                        {/* ── 在看 (Do) Section ─────────────── */}
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
                                                year={years[`tv_season-${record.tmdb_id}`]}
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
                                                year={years[`movie-${record.tmdb_id}`]}
                                            />
                                        );
                                    }
                                })}
                            </Box>
                        )}

                        {/* ── Other Statuses ─────────────── */}
                        {(['Wish', 'Collect', 'OnHold', 'Dropped'] as const).map((status) => {
                            if (itemsByStatus[status].length === 0) return null;
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
