import {Box, Typography} from '@mui/material';
import {getPosterUrl} from '../api/tmdb';
import type {TMDBSeasonSummary} from '../types';
import {getSeasonOverview, getSeasonTitle} from '../utils/seasonDetails';
import ExpandableOverview from './ExpandableOverview';

interface SeasonDetailsProps {
    summary: TMDBSeasonSummary;
    showOverview: string;
    isOnlySeason: boolean;
}

/** 本季信息直接来自整剧详情的季摘要，不依赖单集接口，也不创建观看记录。 */
export default function SeasonDetails({summary, showOverview, isOnlySeason}: SeasonDetailsProps) {
    const overview = getSeasonOverview(summary.overview, showOverview, isOnlySeason);
    const date = summary.air_date && /^\d{4}-\d{2}-\d{2}$/.test(summary.air_date) ? summary.air_date : '';
    const score = summary.vote_average;
    const hasScore = typeof score === 'number' && Number.isFinite(score) && score > 0;
    const hasPoster = Boolean(summary.poster_path);
    if (!hasPoster && !overview && !date && !hasScore) return null;

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: hasPoster ? {xs: '64px minmax(0, 1fr)', sm: '96px minmax(0, 1fr)'} : 'minmax(0, 1fr)',
            columnGap: {xs: 1.5, sm: 2},
            rowGap: 1.5,
            alignItems: 'start',
            mb: 2,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
        }}>
            {hasPoster && <Box component="img" src={getPosterUrl(summary.poster_path, 'w185')}
                               alt={`${getSeasonTitle(summary)}海报`} loading="lazy" decoding="async"
                               sx={{
                                   gridColumn: 1,
                                   gridRow: {xs: '1', sm: overview ? '1 / span 2' : '1'},
                                   width: '100%',
                                   aspectRatio: '2 / 3',
                                   objectFit: 'cover',
                                   borderRadius: 1,
                                   backgroundColor: 'action.hover',
                               }}/>}
            <Box sx={{
                gridColumn: hasPoster ? 2 : 1, gridRow: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5
            }}>
                {date && <Typography variant="caption" color="text.secondary">
                    首播：<Box component="time" dateTime={date}>{date}</Box>
                </Typography>}
                <Typography variant="caption" color="text.secondary">共 {summary.episode_count} 集</Typography>
                {hasScore && <Typography variant="caption" color="text.secondary">
                    本季评分 <Box component="span" aria-label={`本季 TMDB 评分 ${score.toFixed(1)}`} sx={theme => ({
                    ml: 0.5, fontWeight: 700,
                    color: theme.palette.mode === 'light' ? '#9b6500' : '#FFE082',
                })}>{score.toFixed(1)}</Box>
                </Typography>}
            </Box>
            {overview && <Box sx={{gridColumn: {xs: '1 / -1', sm: hasPoster ? '2' : '1'}, gridRow: 2, minWidth: 0}}>
                <ExpandableOverview text={overview}/>
            </Box>}
        </Box>
    );
}
