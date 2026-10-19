import {Box, Typography} from '@mui/material';
import type {ReactNode} from 'react';
import type {TMDBEpisode} from '../types';
import {getEpisodeDetails} from '../utils/episodeDetails';
import {getEpisodeTitle} from './episodeTitle';
import ExpandableOverview from './ExpandableOverview';

/** 详情文字与集号按钮分离，阅读或展开简介不会改变观看记录。 */
export default function EpisodeDetails({episode, children}: {episode: TMDBEpisode; children: ReactNode}) {
    const title = getEpisodeTitle(episode);
    const {airDate, runtime, overview} = getEpisodeDetails(episode);

    return (
        <Box component="li" aria-label={`第 ${episode.episode_number} 集详情`} sx={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            columnGap: {xs: 1.25, sm: 1.5},
            rowGap: 1,
            alignItems: 'start',
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&:first-of-type': {pt: 0.5},
            '&:last-of-type': {borderBottom: 0, pb: 0},
        }}>
            <Box sx={{alignSelf: 'center'}}>{children}</Box>
            <Box sx={{minWidth: 0}}>
                <Typography variant="body2" component="h3" sx={{fontWeight: 600, overflowWrap: 'anywhere'}}>
                    {title || `第 ${episode.episode_number} 集`}
                </Typography>
                {(airDate || runtime !== undefined) && (
                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.25, overflowWrap: 'anywhere'}}>
                        {airDate && <>首播：<Box component="time" dateTime={airDate}>{airDate}</Box></>}
                        {airDate && runtime !== undefined ? ' · ' : ''}
                        {runtime !== undefined && `${runtime} 分钟`}
                    </Typography>
                )}
            </Box>
            {overview && <Box sx={{gridColumn: '1 / -1', minWidth: 0}}>
                <ExpandableOverview text={overview} indentFirstLine/>
            </Box>}
        </Box>
    );
}
