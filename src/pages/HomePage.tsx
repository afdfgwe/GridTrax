import SortIcon from '@mui/icons-material/Sort';
import { Box, Card, CardActionArea, CardContent, CardMedia, Container, Grid, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosterUrl } from '../api/tmdb';
import HomeActiveCard from '../components/HomeActiveCard';
import HomeMovieActiveCard from '../components/HomeMovieActiveCard';
import { useProgressStore } from '../store/useProgressStore';
import { STATUS_LABELS, type MovieRecord, type ProgressRecord, type SeasonRecord, type SortMode, type WatchStatus } from '../types';

// ─── Sorting helpers ─────────────────────────────────────────

const zhCollator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base', numeric: true });

const SORT_LABELS: Record<SortMode, string> = {
    recent: '最近互动',
    name: '名称',
    rating: '评分',
};

const getRecordName = (r: ProgressRecord): string => {
    if (r.type === 'tv_season') {
        return (r as SeasonRecord).show_name || r.name || '';
    }
    return r.name || '';
};

/**
 * Sort records by the given mode.
 * For "rating": user rating descending; unrated items fall back to
 *               recent-interaction order and are placed AFTER all rated items.
 */
const sortRecords = (items: ProgressRecord[], mode: SortMode): ProgressRecord[] => {
    const sorted = [...items];
    switch (mode) {
        case 'recent':
            sorted.sort((a, b) => (b.last_interacted ?? 0) - (a.last_interacted ?? 0));
            break;
        case 'name':
            sorted.sort((a, b) => zhCollator.compare(getRecordName(a), getRecordName(b)));
            break;
        case 'rating': {
            const rated = sorted.filter((r) => r.rating > 0);
            const unrated = sorted.filter((r) => !r.rating);
            rated.sort((a, b) => b.rating - a.rating);
            unrated.sort((a, b) => (b.last_interacted ?? 0) - (a.last_interacted ?? 0));
            return [...rated, ...unrated];
        }
    }
    return sorted;
};

// ─── Per-section localStorage persistence ────────────────────

const STORAGE_PREFIX = 'gridtrax-sort-';
const ALL_STATUSES: WatchStatus[] = ['Do', 'Wish', 'Collect', 'OnHold', 'Dropped'];

const getSectionSortMode = (status: WatchStatus): SortMode => {
    try {
        const stored = localStorage.getItem(STORAGE_PREFIX + status);
        if (stored && (stored === 'recent' || stored === 'name' || stored === 'rating')) return stored;
    } catch { /* noop */ }
    return 'recent';
};

const saveSectionSortMode = (status: WatchStatus, mode: SortMode) => {
    try { localStorage.setItem(STORAGE_PREFIX + status, mode); } catch { /* noop */ }
};

// ─── SectionSortButton sub-component ─────────────────────────

interface SectionSortButtonProps {
    sortMode: SortMode;
    onSortChange: (mode: SortMode) => void;
    primary: string;
}

const SectionSortButton: React.FC<SectionSortButtonProps> = ({ sortMode, onSortChange, primary }) => {
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
                <SortIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontSize="0.7rem" fontWeight={600}>{SORT_LABELS[sortMode]}</Typography>
            </IconButton>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 130 } } }}
            >
                {(['recent', 'name', 'rating'] as SortMode[]).map((mode) => (
                    <MenuItem
                        key={mode}
                        selected={sortMode === mode}
                        onClick={() => { onSortChange(mode); setAnchor(null); }}
                        sx={{ fontSize: '0.85rem', fontWeight: sortMode === mode ? 700 : 400 }}
                    >
                        {SORT_LABELS[mode]}
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

    const handleSortChange = useCallback((status: WatchStatus, mode: SortMode) => {
        setSortModes((prev) => ({ ...prev, [status]: mode }));
        saveSectionSortMode(status, mode);
    }, []);

    const trackedItems = useMemo(() => {
        return Object.values(records).filter((record) => record.global_status);
    }, [records]);

    const itemsByStatus = useMemo(() => {
        const groups: Record<WatchStatus, (SeasonRecord | MovieRecord)[]> = {
            Do: [], Wish: [], Collect: [], OnHold: [], Dropped: [],
        };
        trackedItems.forEach((item) => {
            if (item.global_status) groups[item.global_status].push(item);
        });
        // Sort each group with its own mode
        for (const s of ALL_STATUSES) {
            groups[s] = sortRecords(groups[s], sortModes[s]) as (SeasonRecord | MovieRecord)[];
        }
        return groups;
    }, [trackedItems, sortModes]);

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
        const tagText = isTv ? (tvRecord?.name || `第 ${tvRecord?.season_number} 季`) : '电影';
        const key = `${record.type}-${record.tmdb_id}-${isTv ? tvRecord?.season_number : ''}`;

        return (
            <Grid key={key} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
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
                        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                    >
                        <Box sx={{ position: 'relative' }}>
                            {record.poster_path ? (
                                <CardMedia
                                    component="img"
                                    image={getPosterUrl(record.poster_path, 'w342')}
                                    alt={titleText}
                                    sx={{ aspectRatio: '2/3', objectFit: 'cover', backgroundColor: alpha('#fff', 0.05) }}
                                />
                            ) : (
                                <Box sx={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(primary, 0.1) }}>
                                    <Typography variant="caption" color="primary">No Poster</Typography>
                                </Box>
                            )}
                        </Box>
                        <CardContent sx={{ flex: 1, p: 1.5, pb: '12px !important' }}>
                            <Typography variant="body2" fontWeight={700} noWrap title={titleText}>
                                {titleText}
                            </Typography>
                            {isTv && titleText !== tagText ? (
                                <Typography
                                    sx={{
                                        display: 'inline-block',
                                        backgroundColor: alpha(primary, 0.15),
                                        color: primary,
                                        px: 0.75,
                                        py: 0.25,
                                        borderRadius: 1,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        mt: 0.5
                                    }}
                                >
                                    {tagText}
                                </Typography>
                            ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    {tagText}
                                </Typography>
                            )}
                            {record.rating > 0 && (
                                <Typography variant="caption" sx={{ color: primary, fontWeight: 700, display: 'block', mt: 0.5 }}>
                                    ★ {record.rating}/10
                                </Typography>
                            )}
                        </CardContent>
                    </CardActionArea>
                </Card>
            </Grid>
        );
    };

    // ─── Section header with inline sort button ──────────────
    const renderSectionHeader = (status: WatchStatus, count: number) => (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    '&::before': { content: '""', width: 4, height: 16, backgroundColor: primary, mr: 1, borderRadius: 1 },
                }}
            >
                {STATUS_LABELS[status]} ({count})
            </Typography>
            <SectionSortButton
                sortMode={sortModes[status]}
                onSortChange={(mode) => handleSortChange(status, mode)}
                primary={primary}
            />
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh' }}>
            <Container maxWidth="lg" sx={{ pt: 2, pb: 6 }}>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
                    正在追踪
                </Typography>

                {trackedItems.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 10 }}>
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
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
                            <Box sx={{ mb: 6 }}>
                                {renderSectionHeader('Do', itemsByStatus.Do.length)}
                                {itemsByStatus.Do.map((record) => {
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
                                            />
                                        );
                                    }
                                })}
                            </Box>
                        )}

                        {/* ── Other Statuses ─────────────── */}
                        {(['Wish', 'Collect', 'OnHold', 'Dropped'] as const).map((status) => {
                            const items = itemsByStatus[status];
                            if (items.length === 0) return null;

                            return (
                                <Box key={status} sx={{ mb: 5 }}>
                                    {renderSectionHeader(status, items.length)}
                                    <Grid container spacing={2}>
                                        {items.map(renderCompactCard)}
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
