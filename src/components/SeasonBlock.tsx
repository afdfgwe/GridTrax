import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
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
import type {SeasonRecord, TMDBSeason, TMDBSeasonSummary, WatchStatus} from '../types';
import {STATUS_LABELS} from '../types';
import EpisodeGrid from './EpisodeGrid';
import EpisodeViewToggle from './EpisodeViewToggle';
import GlobalStatusPicker from './GlobalStatusPicker';
import SeasonDetails from './SeasonDetails';
import {getSeasonTitle} from '../utils/seasonDetails';

interface SeasonBlockProps {
    tvId: number;
    showName: string;
    showPosterPath?: string;
    showOverview: string;
    isOnlySeason: boolean;
    seasonSummary: TMDBSeasonSummary;
    defaultExpanded?: boolean;
}

/** 电视剧详情中的单季折叠区；摘要随整剧返回，展开后才按需请求完整集数。 */
const SeasonBlock: React.FC<SeasonBlockProps> = ({
                                                     tvId,
                                                     showName,
                                                     showPosterPath,
                                                     showOverview,
                                                     isOnlySeason,
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

    const setSeasonStatus = useProgressStore((state) => state.setSeasonStatus);
    const record = useProgressStore((state) => state.data.records[`tmdb_tv_${tvId}_s${seasonSummary.season_number}`] as SeasonRecord | undefined);
    const primary = theme.palette.primary.main;

    // 已加载的季详情在本组件内复用；收起或卸载后忽略未完成请求的返回结果。
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

    // 保存操作携带展示元数据；季海报缺失时回退到整部剧海报。
    const metaPayload = {
        name: seasonSummary.name,
        show_name: showName,
        poster_path: seasonSummary.poster_path || showPosterPath,
        episode_count: seasonSummary.episode_count,
    };

    // 不因浏览或展开就调用 ensureSeasonRecord 创建记录。
    // 记录仅在用户主动选择状态或操作某一集时按需创建。

    // 仅统计接口实际返回的集数，避免旧记录中的无效集号影响当前季进度。
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
    const seasonYear = seasonSummary.air_date?.match(/^\d{4}/)?.[0];

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, isExpanded) => {
                setExpanded(isExpanded);
                // 上次失败且没有缓存详情时，再次展开会清除错误并重试加载。
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
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, mr: 1, flexWrap: 'wrap'}}>
                    <Box sx={{flex: '1 1 160px', minWidth: 0}}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{color: 'text.primary', overflowWrap: 'anywhere'}}>
                            {getSeasonTitle(seasonSummary)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {seasonYear ? `${seasonYear}年 · ` : ''}{seasonSummary.episode_count}集
                        </Typography>
                    </Box>
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
                <SeasonDetails summary={seasonSummary} showOverview={showOverview} isOnlySeason={isOnlySeason}/>

                {/* 折叠区内的整季观看状态选择器，展示默认值不等于已写入记录。 */}
                <Box sx={{mb: 2}}>
                    <GlobalStatusPicker
                        status={record?.global_status ?? undefined}
                        onStatusChange={(s: WatchStatus) => {
                            // 用户明确选择状态后才创建或更新当前季记录。
                            setSeasonStatus(tvId, seasonSummary.season_number, s, metaPayload);
                        }}
                    />
                </Box>

                {/* 季详情加载中的占位骨架。 */}
                {loading && (
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '6px', mb: 2}}>
                        {Array.from({length: seasonSummary.episode_count}).map((_, i) => (
                            <Skeleton key={i} variant="rounded" width={36} height={36} sx={{borderRadius: '4px'}}/>
                        ))}
                    </Box>
                )}
                {seasonError &&
                    <Alert severity="error" sx={{mb: 2}} action={<Button color="inherit" size="small" onClick={() => {
                        setSeasonError(false);
                        setLoading(true);
                    }}>重试</Button>}>集数加载失败，请检查网络后重试。</Alert>}

                {/* 详情页传入排序后的完整一季，不使用首页每页 18 集的分页限制。 */}
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
