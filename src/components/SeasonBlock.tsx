import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Chip,
    IconButton,
    Skeleton,
    Tooltip,
    Typography,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useEffect, useState} from 'react';
import {getTVSeason} from '../api/tmdb';
import {useProgressStore} from '../store/useProgressStore';
import type {TMDBSeason, TMDBSeasonSummary, WatchStatus} from '../types';
import {STATUS_LABELS} from '../types';
import EpisodeGrid from './EpisodeGrid';
import EpisodeViewToggle from './EpisodeViewToggle';
import GlobalStatusPicker from './GlobalStatusPicker';

interface SeasonBlockProps {
    tvId: number;
    showName: string;
    showPosterPath?: string;
    seasonSummary: TMDBSeasonSummary;
    defaultExpanded?: boolean;
}

const SeasonBlock: React.FC<SeasonBlockProps> = ({
                                                     tvId,
                                                     showName,
                                                     showPosterPath,
                                                     seasonSummary,
                                                     defaultExpanded = false
                                                 }) => {
    const theme = useTheme();
    const [season, setSeason] = useState<TMDBSeason | null>(null);
    const [loading, setLoading] = useState(defaultExpanded);
    const [seasonError, setSeasonError] = useState(false);
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [episodeOrder, setEpisodeOrder] = useState<'asc' | 'desc'>('asc');
    const [showEpisodeTitles, setShowEpisodeTitles] = useState(false);

    const {
        getSeasonRecord,
        setSeasonStatus,
    } = useProgressStore();

    const record = getSeasonRecord(tvId, seasonSummary.season_number);
    const primary = theme.palette.primary.main;

    useEffect(() => {
        if (!expanded || !loading || season) return;

        let active = true;
        getTVSeason(tvId, seasonSummary.season_number)
            .then((nextSeason) => {
                if (!active) return;
                setSeason(nextSeason);
                setLoading(false);
            })
            .catch(() => {
                if (!active) return;
                setSeasonError(true);
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [expanded, tvId, seasonSummary.season_number, season, loading]);

    const metaPayload = {
        name: seasonSummary.name,
        show_name: showName,
        poster_path: seasonSummary.poster_path || showPosterPath,
        episode_count: seasonSummary.episode_count,
    };

    // NOTE: Do NOT call ensureSeasonRecord here.
    // Records should only be created when the user explicitly sets a status.

    const watchedCount = season && record
        ? season.episodes.filter(
            (ep) => record.episodes[String(ep.episode_number)]?.watched ?? false
        ).length
        : 0;
    const orderedEpisodes = season
        ? [...season.episodes].sort((a, b) =>
            episodeOrder === 'asc'
                ? a.episode_number - b.episode_number
                : b.episode_number - a.episode_number
        )
        : [];

    const statusLabel = record?.global_status ? STATUS_LABELS[record.global_status] : null;

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, isExpanded) => {
                setExpanded(isExpanded);
                if (isExpanded && !season) {
                    setSeasonError(false);
                    setLoading(true);
                }
            }}
            sx={{
                backgroundColor: alpha(primary, 0.05),
                border: `1px solid ${alpha(primary, 0.15)}`,
                borderRadius: '8px !important',
                '&::before': {display: 'none'},
                mb: 1.5,
                '&.Mui-expanded': {my: 1.5},
            }}
            disableGutters
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{color: primary}}/>}
                sx={{
                    borderRadius: '8px',
                    '&.Mui-expanded': {borderRadius: '8px 8px 0 0'},
                    px: 2,
                    py: 0.5,
                }}
            >
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap'}}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{color: 'text.primary'}}>
                        {seasonSummary.name}
                    </Typography>
                    <Chip
                        label={`${seasonSummary.episode_count} 集`}
                        size="small"
                        sx={{
                            backgroundColor: alpha(primary, 0.15),
                            color: primary,
                            fontWeight: 600,
                            fontSize: '0.7rem'
                        }}
                    />
                    {season && (
                        <Chip
                            label={`${watchedCount}/${season.episodes.length} 已看`}
                            size="small"
                            sx={{
                                backgroundColor: alpha('#4CAF50', 0.15),
                                color: '#4CAF50',
                                fontWeight: 600,
                                fontSize: '0.7rem'
                            }}
                        />
                    )}
                    {statusLabel && (
                        <Chip
                            label={statusLabel}
                            size="small"
                            sx={{
                                backgroundColor: alpha(primary, 0.2),
                                color: primary,
                                fontWeight: 600,
                                fontSize: '0.7rem'
                            }}
                        />
                    )}
                </Box>
            </AccordionSummary>

            <AccordionDetails sx={{px: 2, pb: 2}}>
                {/* Watch status - only render when accordion is open */}
                <Box sx={{mb: 2}}>
                    <GlobalStatusPicker
                        status={record?.global_status ?? undefined}
                        onStatusChange={(s: WatchStatus) => {
                            // This is the primary trigger that creates the record and sets status
                            setSeasonStatus(tvId, seasonSummary.season_number, s, metaPayload);
                        }}
                    />
                </Box>

                {/* Episodes Loading Skeleton */}
                {loading && (
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '6px', mb: 2}}>
                        {Array.from({length: seasonSummary.episode_count}).map((_, i) => (
                            <Skeleton key={i} variant="rounded" width={36} height={36} sx={{borderRadius: '4px'}}/>
                        ))}
                    </Box>
                )}
                {seasonError && <Alert severity="error" sx={{mb: 2}}>集数加载失败，请收起后重试。</Alert>}

                {/* Episode Grid */}
                {season && (
                    <>
                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 1}}>
                            <EpisodeViewToggle
                                episodes={orderedEpisodes}
                                showTitles={showEpisodeTitles}
                                onChange={() => setShowEpisodeTitles((value) => !value)}
                            />
                            <Tooltip title={episodeOrder === 'asc' ? '倒序排列' : '正序排列'}>
                                <IconButton
                                    size="small"
                                    aria-label={episodeOrder === 'asc' ? '倒序排列集数' : '正序排列集数'}
                                    onClick={() => setEpisodeOrder((order) => (order === 'asc' ? 'desc' : 'asc'))}
                                    sx={{
                                        border: `1px solid ${alpha(primary, episodeOrder === 'desc' ? 0.45 : 0.2)}`,
                                        borderRadius: 1.5,
                                        color: episodeOrder === 'desc' ? primary : 'text.secondary',
                                        backgroundColor: episodeOrder === 'desc' ? alpha(primary, 0.08) : 'transparent',
                                    }}
                                >
                                    <SwapVertIcon fontSize="small"/>
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <EpisodeGrid
                            tvId={tvId}
                            seasonNumber={seasonSummary.season_number}
                            episodes={orderedEpisodes}
                            metaPayload={metaPayload}
                            showTitles={showEpisodeTitles}
                        />
                    </>
                )}

            </AccordionDetails>
        </Accordion>
    );
};

export default SeasonBlock;
