import {
    Alert,
    Box,
    LinearProgress,
    Snackbar,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useCallback, useState} from 'react';
import {useProgressStore} from '../store/useProgressStore';
import type {SeasonRecord, TMDBEpisode} from '../types';
import EpisodeCell from './EpisodeCell';
import EpisodeDetails from './EpisodeDetails';

interface EpisodeGridProps {
    tvId: number;
    seasonNumber: number;
    /** 可为完整一季，也可为首页当前页的集数；所有操作仍按真实集号定位。 */
    episodes: TMDBEpisode[];
    metaPayload?: { name?: string; show_name?: string; poster_path?: string; episode_count?: number };
    /** 首页已展示整季进度时，隐藏此处基于传入数组计算的局部进度。 */
    hideProgress?: boolean;
    showTitles?: boolean;
    /** 详情模式在所有屏幕逐集展示，仍复用同一套观看操作。 */
    showDetails?: boolean;
}

/** 复用的集数展示与操作层：读取本地进度，并将单集／批量操作交给存储。 */
const EpisodeGrid: React.FC<EpisodeGridProps> = ({
                                                     tvId,
                                                     seasonNumber,
                                                     episodes,
                                                     metaPayload,
                                                     hideProgress = false,
                                                     showTitles = false,
                                                     showDetails = false
                                                 }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    // 标题列表仅在移动端启用，桌面端保持方块与悬停短标题的交互。
    const titleView = !showDetails && isMobile && showTitles;
    const toggleEpisodeWatched = useProgressStore((state) => state.toggleEpisodeWatched);
    const watchUpToEpisode = useProgressStore((state) => state.watchUpToEpisode);
    const record = useProgressStore((state) => state.data.records[`tmdb_tv_${tvId}_s${seasonNumber}`] as SeasonRecord | undefined);

    const [snackbar, setSnackbar] = useState<string | null>(null);

    // 记录随明确操作按需创建，不在渲染时为所有可见季提前建立记录。
    // 此处不能调用 ensureSeasonRecord，否则仅浏览详情也会生成额外记录。

    const handleSingleClick = useCallback(
        (episodeNumber: number) => {
            toggleEpisodeWatched(tvId, seasonNumber, episodeNumber, metaPayload);
        },
        [tvId, seasonNumber, toggleEpisodeWatched, metaPayload]
    );

    // “看到这里”依据真实集号批量标记，与显示顺序、当前页范围无关。
    const handleWatchUpTo = useCallback(
        (episodeNumber: number) => {
            watchUpToEpisode(tvId, seasonNumber, episodeNumber, metaPayload);
            setSnackbar(`已标记第 1 ~ ${episodeNumber} 集为已看 ✓`);
        },
        [tvId, seasonNumber, watchUpToEpisode, metaPayload]
    );

    // 统计范围是传入的 episodes，不保证是整季；分页调用方需要隐藏此进度。
    const watchedCount = episodes.filter(
        (ep) => record?.episodes[String(ep.episode_number)]?.watched
    ).length;
    const progress = episodes.length > 0 ? (watchedCount / episodes.length) * 100 : 0;

    const primary = theme.palette.primary.main;

    return (
        <Box>
            {/* 当前传入集数范围的已看进度。 */}
            {!hideProgress && (
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
                        {watchedCount} / {episodes.length}
                    </Typography>
                </Box>
            )}

            {/* 详情模式逐集排列；普通标题模式两列，方块模式自然换行。 */}
            <Box
                component={showDetails ? 'ul' : 'div'}
                sx={{
                    display: showDetails ? 'block' : titleView ? 'grid' : 'flex',
                    gridTemplateColumns: titleView ? 'repeat(2, minmax(0, 1fr))' : undefined,
                    flexWrap: 'wrap',
                    gap: titleView ? '8px' : '6px',
                    m: 0,
                    p: 0,
                    listStyle: 'none',
                    // 单元格的触摸尺寸由 EpisodeCell 统一控制。
                }}
            >
                {episodes.map((episode) => {
                    const rec = record?.episodes[String(episode.episode_number)];
                    const cell = (
                        <EpisodeCell
                            key={episode.episode_number}
                            episode={episode}
                            watched={rec?.watched ?? false}
                            showTitle={titleView}
                            compact={showDetails}
                            onSingleClick={handleSingleClick}
                            onWatchUpTo={handleWatchUpTo}
                        />
                    );
                    return showDetails ? (
                        <EpisodeDetails key={episode.episode_number} episode={episode}>{cell}</EpisodeDetails>
                    ) : cell;
                })}
            </Box>

            {/* 批量标记完成后短暂提示，不影响继续操作。 */}
            <Snackbar
                open={!!snackbar}
                autoHideDuration={2500}
                onClose={() => setSnackbar(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
            >
                <Alert
                    onClose={() => setSnackbar(null)}
                    severity="success"
                    variant="filled"
                    sx={{borderRadius: 2}}
                >
                    {snackbar}
                </Alert>
            </Snackbar>

        </Box>
    );
};

export default EpisodeGrid;
