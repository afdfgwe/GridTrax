import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import {Box, ButtonBase, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import {useMemo, type ReactNode} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import type {ProgressRecord} from '../types';
import {groupWatchedTimeline} from '../utils/watchedTimeline';
import {getMediaYearKey} from '../utils/mediaYears';
import {getMediaScore} from '../utils/mediaScores';

interface WatchedTimelineProps {
    records: ProgressRecord[];
    scores: Record<string, number>;
    years: Record<string, string>;
    headerActions?: ReactNode;
}

/** 看过板块采用独立时间线，不继承旧网格的排序、类型筛选或分页偏好。 */
export default function WatchedTimeline({records, scores, years, headerActions}: WatchedTimelineProps) {
    const theme = useTheme();
    const primary = theme.palette.primary.main;
    // 分组依据每条记录最后一次操作时间，并非影片上映时间或逐次观影日志。
    const months = useMemo(() => groupWatchedTimeline(records), [records]);
    const count = months.reduce((total, month) => total + month.count, 0);

    return (
        <Box component="section" aria-labelledby="watched-timeline-heading" sx={{
            mb: 5,
            // 两层吸顶共享偏移；导航栏高度与 MUI 默认工具栏的横竖屏规则保持一致。
            '--watched-toolbar-offset': {xs: '56px', sm: '64px'},
            '--watched-heading-height': '44px',
            '--watched-month-height': '44px',
            [`${theme.breakpoints.down('sm')} and (orientation: landscape)`]: {
                '--watched-toolbar-offset': '48px'
            }
        }}>
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2,
                position: 'sticky', top: 'var(--watched-toolbar-offset)', zIndex: 2,
                height: 'var(--watched-heading-height)', backgroundColor: 'background.default'
            }}>
                <Typography id="watched-timeline-heading" component="h2" variant="subtitle1" fontWeight={700}
                            sx={{
                                display: 'flex', alignItems: 'center', '&::before': {
                                    content: '""',
                                    width: 4,
                                    height: 16,
                                    backgroundColor: primary,
                                    mr: 1,
                                    borderRadius: 1,
                                }
                            }}>
                    看过 ({count})
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0}}>
                    <Typography variant="caption" color="text.secondary">最近操作时间</Typography>
                    {headerActions}
                </Box>
            </Box>

            {months.map(month => (
                <Box key={month.key} sx={{
                    // 月份栏上下的留白放进内容区，避免吸顶交接时露出空隙。
                    '& > :last-child': {pb: 3},
                    '& > :nth-of-type(2)': {pt: 1},
                    viewTimelineName: '--watched-month',
                    viewTimelineAxis: 'block',
                    viewTimelineInset: 'calc(var(--watched-toolbar-offset) + var(--watched-heading-height)) calc(100% - var(--watched-toolbar-offset) - var(--watched-heading-height) - var(--watched-month-height))'
                }}>
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1, height: 'var(--watched-month-height)',
                        // 月份只在本月范围内吸顶，并始终位于看过标题栏下方。
                        position: 'sticky',
                        top: 'calc(var(--watched-toolbar-offset) + var(--watched-heading-height))', zIndex: 1,
                        backgroundColor: 'background.default',
                        borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider',
                        '@keyframes watched-month-exit': {
                            from: {opacity: 1, transform: 'translateY(0)'},
                            to: {opacity: 0, transform: 'translateY(-4px)'}
                        },
                        '& > *': {
                            // 淡出进度跟随本月退出吸顶区的距离；反向滚动时自然恢复。
                            '@supports (animation-timeline: --watched-month) and (animation-range: exit 0% exit 100%)': {
                                '@media (prefers-reduced-motion: no-preference)': {
                                    animation: 'watched-month-exit 1s linear both',
                                    animationTimeline: '--watched-month',
                                    animationRange: 'exit 0% exit 100%'
                                }
                            }
                        }
                    }}>
                        <Typography component="h3" variant="body2" fontWeight={700}>{month.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{month.count} 部</Typography>
                    </Box>

                    {month.days.map(day => (
                        <Box key={day.key} sx={{
                            display: 'grid',
                            gridTemplateColumns: {xs: '40px minmax(0, 1fr)', sm: '72px minmax(0, 1fr)'},
                            columnGap: {xs: 1.5, sm: 2}
                        }}>
                            <Box sx={{textAlign: 'center', pt: 0.75}}>
                                <Typography sx={{
                                    fontSize: {xs: '1.25rem', sm: '1.5rem'}, fontWeight: 700,
                                    lineHeight: 1.2, fontVariantNumeric: 'tabular-nums'
                                }}>{day.day}</Typography>
                                <Typography variant="caption" color="text.secondary"
                                            sx={{fontSize: '0.7rem'}}>{day.weekday}</Typography>
                                <Typography variant="caption" color="text.secondary"
                                            aria-label={`当天观看数量：${day.entries.length}`}
                                            sx={{
                                                display: 'block', mt: 0.25, fontSize: '0.7rem',
                                                fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere'
                                            }}>（{day.entries.length}）</Typography>
                            </Box>
                            <Box component="ol" sx={{
                                listStyle: 'none', m: 0, pl: {xs: 1.5, sm: 2.5}, pb: 1,
                                // 同一天的记录按时间顺序横向排列，窄屏保留单列阅读方式。
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: 'minmax(0, 1fr)',
                                    md: 'repeat(2, minmax(0, 1fr))',
                                    lg: 'repeat(3, minmax(0, 1fr))'
                                },
                                columnGap: {md: 2, lg: 3},
                                borderLeft: '1px solid', borderColor: alpha(primary, 0.25)
                            }}>
                                {day.entries.map(({record}, index) => {
                                    const isTv = record.type === 'tv_season';
                                    const title = isTv
                                        ? record.show_name || record.name || `剧集 ID: ${record.tmdb_id}`
                                        : record.name || `电影 ID: ${record.tmdb_id}`;
                                    const tag = isTv
                                        ? record.name && record.name !== title ? record.name : `第 ${record.season_number} 季`
                                        : '电影';
                                    const key = `${record.type}-${record.tmdb_id}`;
                                    const score = getMediaScore(record, scores);
                                    const year = years[getMediaYearKey(record)];
                                    const hasScore = Number.isFinite(score) && score > 0;
                                    const PlaceholderIcon = isTv ? TvOutlinedIcon : MovieOutlinedIcon;

                                    return (
                                        <Box component="li" key={`${key}-${isTv ? record.season_number : ''}`} data-media-key={key} sx={{
                                            position: 'relative',
                                            minWidth: 0,
                                            ...(index === 0 ? {
                                                '&::before': {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: 17,
                                                    left: {xs: -17, sm: -25},
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: '50%',
                                                    backgroundColor: primary,
                                                    boxShadow: `0 0 0 3px ${theme.palette.background.default}`,
                                                }
                                            } : {})
                                        }}>
                                            <ButtonBase component={RouterLink}
                                                        to={`/${isTv ? 'tv' : 'movie'}/${record.tmdb_id}`}
                                                        aria-label={`${title} · ${tag}`}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            textAlign: 'left',
                                                            width: '100%',
                                                            height: '100%',
                                                            minWidth: 0,
                                                            gap: {xs: 1.25, sm: 2},
                                                            py: 1,
                                                            px: 0.5,
                                                            borderRadius: 1,
                                                            color: 'text.primary',
                                                            '&:hover': {backgroundColor: alpha(primary, 0.06)},
                                                            '&.Mui-focusVisible': {
                                                                outline: '2px solid',
                                                                outlineColor: primary,
                                                                outlineOffset: 2
                                                            }
                                                        }}>
                                                {/* 固定尺寸海报保持长列表稳定；屏幕外的图片由浏览器按需加载。 */}
                                                <Box sx={{
                                                    width: {xs: 48, sm: 64},
                                                    aspectRatio: '2/3',
                                                    flexShrink: 0,
                                                    borderRadius: 1,
                                                    overflow: 'hidden',
                                                    backgroundColor: alpha(primary, 0.08),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {record.poster_path ? (
                                                        <Box component="img"
                                                             src={getPosterUrl(record.poster_path, 'w154')} alt=""
                                                             loading="lazy" decoding="async"
                                                             sx={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                    ) : <PlaceholderIcon sx={{color: 'text.secondary', fontSize: 24}}/>}
                                                </Box>
                                                <Box sx={{flex: 1, minWidth: 0}}>
                                                    <Typography variant="body2" fontWeight={700} title={title}
                                                                sx={{
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: 'vertical',
                                                                    overflow: 'hidden',
                                                                    overflowWrap: 'anywhere'
                                                                }}>{title}</Typography>
                                                    <Box sx={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        alignItems: 'baseline',
                                                        gap: 0.75,
                                                        mt: 0.5
                                                    }}>
                                                        <Typography variant="caption"
                                                                    color={isTv ? 'primary' : 'text.secondary'}
                                                                    sx={{overflowWrap: 'anywhere'}}>{tag}</Typography>
                                                        {hasScore && <Typography variant="caption"
                                                                                 aria-label={`TMDB 评分 ${score.toFixed(1)}`}
                                                                                 sx={{
                                                                                     fontWeight: 700,
                                                                                     color: theme.palette.mode === 'light' ? '#9b6500' : '#FFE082'
                                                                                 }}>
                                                            {score.toFixed(1)}
                                                        </Typography>}
                                                    </Box>
                                                    {year && <Typography variant="caption" color="text.secondary"
                                                                         sx={{
                                                                             display: 'block',
                                                                             mt: 0.5,
                                                                             fontSize: '0.7rem',
                                                                             fontVariantNumeric: 'tabular-nums'
                                                                         }}>
                                                        {year}年
                                                    </Typography>}
                                                </Box>
                                                <ChevronRightIcon sx={{
                                                    display: {xs: 'none', sm: 'block'},
                                                    flexShrink: 0,
                                                    fontSize: 18,
                                                    color: 'text.secondary'
                                                }}/>
                                            </ButtonBase>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    ))}
                </Box>
            ))}
        </Box>
    );
}
