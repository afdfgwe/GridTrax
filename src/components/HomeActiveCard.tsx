import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { Box, Card, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosterUrl, getTVSeason } from '../api/tmdb';
import { useProgressStore } from '../store/useProgressStore';
import type { TMDBSeason } from '../types';
import EpisodeGrid from './EpisodeGrid';
import HomeQuickEdit from './HomeQuickEdit';

const EPISODES_PER_PAGE = 18;

interface HomeActiveCardProps {
    tvId: number;
    seasonNumber: number;
    name?: string;
    showName?: string;
    posterPath?: string;
    episodeCount?: number;
}

const HomeActiveCard: React.FC<HomeActiveCardProps> = ({
    tvId,
    seasonNumber,
    name,
    showName,
    posterPath,
    episodeCount
}) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const [season, setSeason] = useState<TMDBSeason | null>(null);
    const [episodePage, setEpisodePage] = useState(0);
    const [episodeOrder, setEpisodeOrder] = useState<'asc' | 'desc'>('asc');
    const [loadingSeason, setLoadingSeason] = useState(false);

    const { getSeasonRecord } = useProgressStore();
    const record = getSeasonRecord(tvId, seasonNumber);

    useEffect(() => {
        let active = true;

        setSeason(null);
        setEpisodePage(0);
        setLoadingSeason(true);

        getTVSeason(tvId, seasonNumber)
            .then((nextSeason) => {
                if (!active) return;

                setSeason(nextSeason);

                const latestRecord = useProgressStore.getState().getSeasonRecord(tvId, seasonNumber);
                const firstUnwatchedIndex = nextSeason.episodes.findIndex(
                    (episode) => !latestRecord?.episodes[String(episode.episode_number)]?.watched
                );
                const initialIndex = firstUnwatchedIndex >= 0
                    ? firstUnwatchedIndex
                    : Math.max(nextSeason.episodes.length - 1, 0);

                setEpisodePage(Math.floor(initialIndex / EPISODES_PER_PAGE));
            })
            .finally(() => {
                if (active) setLoadingSeason(false);
            });

        return () => {
            active = false;
        };
    }, [tvId, seasonNumber]);

    const handleCardClick = () => {
        navigate(`/tv/${tvId}`);
    };

    const primary = theme.palette.primary.main;
    const titleText = showName || name || `剧集 ID: ${tvId}`;
    const tagText = name || `第 ${seasonNumber} 季`;
    const poster = posterPath ? getPosterUrl(posterPath, 'w154') : undefined;
    const meta = { name, show_name: showName, poster_path: posterPath, episode_count: episodeCount };
    const totalEpisodes = season?.episodes.length ?? episodeCount ?? 0;
    const rawWatchedCount = record
        ? Object.values(record.episodes).filter((episode) => episode.watched).length
        : 0;
    const watchedCount = totalEpisodes > 0 ? Math.min(rawWatchedCount, totalEpisodes) : rawWatchedCount;
    const progress = totalEpisodes > 0 ? Math.min((watchedCount / totalEpisodes) * 100, 100) : 0;
    const orderedEpisodes = season
        ? [...season.episodes].sort((a, b) =>
            episodeOrder === 'asc'
                ? a.episode_number - b.episode_number
                : b.episode_number - a.episode_number
        )
        : [];
    const totalPages = season ? Math.max(Math.ceil(orderedEpisodes.length / EPISODES_PER_PAGE), 1) : 1;
    const currentPage = Math.min(episodePage, totalPages - 1);
    const pageStart = currentPage * EPISODES_PER_PAGE;
    const pageEnd = season ? Math.min(pageStart + EPISODES_PER_PAGE, orderedEpisodes.length) : 0;
    const visibleEpisodes = orderedEpisodes.slice(pageStart, pageEnd);
    const pageFirstEpisode = visibleEpisodes[0]?.episode_number ?? 0;
    const pageLastEpisode = visibleEpisodes[visibleEpisodes.length - 1]?.episode_number ?? 0;
    const handleToggleEpisodeOrder = () => {
        setEpisodeOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
        setEpisodePage(0);
    };

    return (
        <Card
            sx={{
                display: 'flex',
                flexDirection: 'column',
                mb: 3,
                borderRadius: 2,
                backgroundColor: alpha(primary, 0.03),
                border: `1px solid ${alpha(primary, 0.1)}`,
                transition: 'box-shadow 0.2s ease',
                '&:hover': {
                    boxShadow: `0 4px 20px ${alpha(primary, 0.1)}`,
                }
            }}
        >
            <Box sx={{ display: 'flex', p: 2 }}>
                {/* Poster */}
                <Box
                    sx={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={handleCardClick}
                >
                    {poster ? (
                        <Box
                            component="img"
                            src={poster}
                            alt={titleText}
                            sx={{ width: { xs: 64, sm: 80 }, aspectRatio: '2/3', height: 'auto', borderRadius: 1.5, objectFit: 'cover', mr: 2 }}
                        />
                    ) : (
                        <Box sx={{ width: { xs: 64, sm: 80 }, aspectRatio: '2/3', height: 'auto', borderRadius: 1.5, backgroundColor: alpha(primary, 0.1), mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" color="primary">No Poster</Typography>
                        </Box>
                    )}
                </Box>

                {/* Info */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }} onClick={handleCardClick}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" fontWeight={700}>{titleText}</Typography>
                        {tagText && titleText !== tagText && (
                            <Typography
                                component="span"
                                sx={{
                                    backgroundColor: primary,
                                    color: theme.palette.getContrastText(primary),
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                }}
                            >
                                {tagText}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {episodeCount ? `共 ${episodeCount} 集` : '在看'}
                        </Typography>
                        {record?.rating ? (
                            <Typography variant="body2" sx={{ color: primary, fontWeight: 700 }}>
                                ★ {record.rating}/10
                            </Typography>
                        ) : null}
                    </Box>
                </Box>

                {/* Quick Edit Button */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 0.5 }}>
                    <HomeQuickEdit
                        recordKey={`tv_${tvId}_s${seasonNumber}`}
                        type="tv_season"
                        tmdbId={tvId}
                        seasonNumber={seasonNumber}
                        meta={meta}
                    />
                </Box>
            </Box>

            <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 1.5,
                            backgroundColor: alpha(primary, 0.15),
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 1.5,
                                background: primary,
                            },
                        }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 60, textAlign: 'right' }}>
                        {watchedCount} / {totalEpisodes || '?'}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Tooltip title="上一页">
                        <span>
                            <IconButton
                                size="small"
                                disabled={loadingSeason || currentPage <= 0}
                                onClick={() => setEpisodePage((page) => Math.max(page - 1, 0))}
                                sx={{ border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 1.5 }}
                            >
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', minWidth: 112, textAlign: 'center', fontWeight: 600 }}
                    >
                        {season ? `第 ${pageFirstEpisode}-${pageLastEpisode} 集` : '正在加载集数…'}
                    </Typography>
                    <Tooltip title="下一页">
                        <span>
                            <IconButton
                                size="small"
                                disabled={loadingSeason || currentPage >= totalPages - 1}
                                onClick={() => setEpisodePage((page) => Math.min(page + 1, totalPages - 1))}
                                sx={{ border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 1.5 }}
                            >
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={episodeOrder === 'asc' ? '倒序排列' : '正序排列'}>
                        <IconButton
                            size="small"
                            disabled={loadingSeason}
                            aria-label={episodeOrder === 'asc' ? '倒序排列集数' : '正序排列集数'}
                            onClick={handleToggleEpisodeOrder}
                            sx={{
                                border: `1px solid ${alpha(primary, episodeOrder === 'desc' ? 0.45 : 0.2)}`,
                                borderRadius: 1.5,
                                color: episodeOrder === 'desc' ? primary : 'text.secondary',
                                backgroundColor: episodeOrder === 'desc' ? alpha(primary, 0.08) : 'transparent',
                            }}
                        >
                            <SwapVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                {season && (
                    <EpisodeGrid
                        tvId={tvId}
                        seasonNumber={seasonNumber}
                        episodes={visibleEpisodes}
                        metaPayload={meta}
                        hideProgress
                    />
                )}
            </Box>
        </Card>
    );
};

export default HomeActiveCard;
