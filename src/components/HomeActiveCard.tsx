import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {Alert, Box, Button, Card, IconButton, LinearProgress, Tooltip, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getPosterUrl, getTVSeason} from '../api/tmdb';
import {useProgressStore} from '../store/useProgressStore';
import type {SeasonRecord, TMDBSeason} from '../types';
import {requestErrorMessage} from '../utils/requestError';
import EpisodeGrid from './EpisodeGrid';
import EpisodeViewToggle from './EpisodeViewToggle';
import HomeQuickEdit from './HomeQuickEdit';
import PosterScoreBadge from './PosterScoreBadge';

// 首页单季卡片每页最多显示 18 集；翻页只改变显示范围，不改变观看记录。
const EPISODES_PER_PAGE = 18;

interface HomeActiveCardProps {
    tvId: number;
    seasonNumber: number;
    name?: string;
    showName?: string;
    posterPath?: string;
    episodeCount?: number;
    score?: number;
    year?: string;
}

/** 首页“在看”电视剧卡片：一张卡片对应一季，含整季进度与集数分页。 */
const HomeActiveCard: React.FC<HomeActiveCardProps> = ({
                                                           tvId,
                                                           seasonNumber,
                                                           name,
                                                           showName,
                                                           posterPath,
                                                           episodeCount,
                                                           score,
                                                           year,
                                                       }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const [season, setSeason] = useState<TMDBSeason | null>(null);
    const [episodePage, setEpisodePage] = useState(0);
    const [episodeOrder, setEpisodeOrder] = useState<'asc' | 'desc'>('asc');
    const [showEpisodeTitles, setShowEpisodeTitles] = useState(false);
    const [loadingSeason, setLoadingSeason] = useState(true);
    const [seasonError, setSeasonError] = useState<string>();
    const [attempt, setAttempt] = useState(0);

    const record = useProgressStore((state) => state.data.records[`tmdb_tv_${tvId}_s${seasonNumber}`] as SeasonRecord | undefined);

    // 卸载后忽略请求结果，防止旧卡片的请求更新状态；这里不取消网络请求本身。
    useEffect(() => {
        let active = true;

        getTVSeason(tvId, seasonNumber)
            .then((nextSeason) => {
                if (!active) return;

                setSeason(nextSeason);

                // 请求返回时重新读取进度，避免用请求发出前的旧记录选择初始页。
                const latestRecord = useProgressStore.getState().getSeasonRecord(tvId, seasonNumber);
                const firstUnwatchedIndex = nextSeason.episodes.findIndex(
                    (episode) => !latestRecord?.episodes[String(episode.episode_number)]?.watched
                );
                // 优先定位第一集未看内容；全部看完则定位最后一集所在页。
                const initialIndex = firstUnwatchedIndex >= 0
                    ? firstUnwatchedIndex
                    : Math.max(nextSeason.episodes.length - 1, 0);

                setEpisodePage(Math.floor(initialIndex / EPISODES_PER_PAGE));
            })
            .catch((error: unknown) => {
                if (active) setSeasonError(requestErrorMessage(error));
            })
            .finally(() => {
                if (active) setLoadingSeason(false);
            });

        return () => {
            active = false;
        };
    }, [tvId, seasonNumber, attempt]);

    const handleCardClick = () => {
        navigate(`/tv/${tvId}`);
    };

    const primary = theme.palette.primary.main;
    const titleText = showName || name || `剧集 ID: ${tvId}`;
    const tagText = name || `第 ${seasonNumber} 季`;
    const poster = posterPath ? getPosterUrl(posterPath, 'w154') : undefined;
    // 写入记录时携带的作品元数据，供快捷编辑与集数操作持久化。
    const meta = {name, show_name: showName, poster_path: posterPath, episode_count: episodeCount};
    // 完整集数优先取季详情；加载前使用存储的总集数作为兜底。
    // 整季进度独立于当前页，旧备份中的多余记录不能使进度超过 100%。
    const totalEpisodes = season?.episodes.length ?? episodeCount ?? 0;
    const rawWatchedCount = record
        ? Object.values(record.episodes).filter((episode) => episode.watched).length
        : 0;
    const watchedCount = totalEpisodes > 0 ? Math.min(rawWatchedCount, totalEpisodes) : rawWatchedCount;
    const progress = totalEpisodes > 0 ? Math.min((watchedCount / totalEpisodes) * 100, 100) : 0;
    // 先复制并排序，再截取当前页，不修改接口返回的原始集数数组。
    const orderedEpisodes = season
        ? [...season.episodes].sort((a, b) =>
            episodeOrder === 'asc'
                ? a.episode_number - b.episode_number
                : b.episode_number - a.episode_number
        )
        : [];
    const totalPages = season ? Math.max(Math.ceil(orderedEpisodes.length / EPISODES_PER_PAGE), 1) : 1;
    // 展示时夹紧页码，防止接口集数变少后落在空页；不在渲染期间更新状态。
    const currentPage = Math.min(episodePage, totalPages - 1);
    const pageStart = currentPage * EPISODES_PER_PAGE;
    const pageEnd = season ? Math.min(pageStart + EPISODES_PER_PAGE, orderedEpisodes.length) : 0;
    const visibleEpisodes = orderedEpisodes.slice(pageStart, pageEnd);
    // 范围文字取当前页首尾的实际集号，因此倒序时可正确显示“第 25-8 集”。
    const pageFirstEpisode = visibleEpisodes[0]?.episode_number ?? 0;
    const pageLastEpisode = visibleEpisodes[visibleEpisodes.length - 1]?.episode_number ?? 0;
    // 切换顺序后回第一页，以便直接看到最早或最新的集数。
    const handleToggleEpisodeOrder = () => {
        setEpisodeOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
        setEpisodePage(0);
    };

    return (
        <Card data-media-key={`tv_season-${tvId}`}
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
            <Box sx={{display: 'flex', p: 2}}>
                {/* 海报与信息区域进入整部剧的详情页，评分由父页面提供。 */}
                <Box
                    sx={{
                        cursor: 'pointer',
                        flexShrink: 0,
                        position: 'relative',
                        width: {xs: 64, sm: 80},
                        height: {xs: 96, sm: 120},
                        mr: 2
                    }}
                    onClick={handleCardClick}
                >
                    {poster ? (
                        <Box
                            component="img"
                            src={poster}
                            alt={titleText}
                            sx={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                borderRadius: 1.5,
                                objectFit: 'cover'
                            }}
                        />
                    ) : (
                        <Box sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 1.5,
                            backgroundColor: alpha(primary, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Typography variant="caption" color="primary">No Poster</Typography>
                        </Box>
                    )}
                    {poster && <PosterScoreBadge score={score}/>}
                </Box>

                {/* 剧名、季标签和整部剧的首播年份。 */}
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: 'pointer'
                }} onClick={handleCardClick}>
                    <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5}}>
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
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Typography variant="body2" color="text.secondary">
                            {year ? `${year}年 · ` : ''}{episodeCount ? `共 ${episodeCount} 集` : '在看'}
                        </Typography>
                    </Box>
                </Box>

                {/* 快捷编辑只操作当前季的观看状态和记录。 */}
                <Box sx={{display: 'flex', alignItems: 'flex-start', pt: 0.5}}>
                    <HomeQuickEdit
                        type="tv_season"
                        tmdbId={tvId}
                        seasonNumber={seasonNumber}
                        meta={meta}
                    />
                </Box>
            </Box>

            <Box sx={{px: {xs: 2, sm: 3}, pb: 2}}>
                {seasonError &&
                    <Alert severity="error" sx={{mb: 1}} action={<Button size="small" color="inherit" onClick={() => {
                        setSeasonError(undefined);
                        setLoadingSeason(true);
                        setAttempt((value) => value + 1);
                    }}>重试</Button>}>{seasonError}</Alert>}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5}}>
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
                    <Typography variant="caption" sx={{color: 'text.secondary', minWidth: 60, textAlign: 'right'}}>
                        {watchedCount} / {totalEpisodes || '?'}
                    </Typography>
                </Box>

                <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1}}>
                    <Tooltip title="上一页">
                        <span>
                            <IconButton
                                size="small"
                                aria-label="上一页集数"
                                disabled={loadingSeason || currentPage <= 0}
                                onClick={() => setEpisodePage((page) => Math.max(page - 1, 0))}
                                sx={{border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 1.5}}
                            >
                                <ChevronLeftIcon fontSize="small"/>
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography
                        variant="caption"
                        sx={{color: 'text.secondary', minWidth: 112, textAlign: 'center', fontWeight: 600}}
                    >
                        {season ? `第 ${pageFirstEpisode}-${pageLastEpisode} 集` : seasonError ? '集数加载失败' : '正在加载集数…'}
                    </Typography>
                    <Tooltip title="下一页">
                        <span>
                            <IconButton
                                size="small"
                                aria-label="下一页集数"
                                disabled={loadingSeason || currentPage >= totalPages - 1}
                                onClick={() => setEpisodePage((page) => Math.min(page + 1, totalPages - 1))}
                                sx={{border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 1.5}}
                            >
                                <ChevronRightIcon fontSize="small"/>
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={episodeOrder === 'asc' ? '倒序排列' : '正序排列'}>
                        <span>
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
                                <SwapVertIcon fontSize="small"/>
                            </IconButton>
                        </span>
                    </Tooltip>
                    <EpisodeViewToggle
                        episodes={orderedEpisodes}
                        showTitles={showEpisodeTitles}
                        onChange={() => setShowEpisodeTitles((value) => !value)}
                    />
                </Box>

                {/* 子组件只接收当前页集数；隐藏其局部进度，使用上方整季进度。 */}
                {season && (
                    <EpisodeGrid
                        tvId={tvId}
                        seasonNumber={seasonNumber}
                        episodes={visibleEpisodes}
                        metaPayload={meta}
                        showTitles={showEpisodeTitles}
                        hideProgress
                    />
                )}
            </Box>
        </Card>
    );
};

export default HomeActiveCard;
