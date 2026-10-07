import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import { ToggleButton, Tooltip } from '@mui/material';
import type { TMDBEpisode } from '../types';
import { getEpisodeTitle } from './episodeTitle';

interface EpisodeViewToggleProps {
    episodes: TMDBEpisode[];
    showTitles: boolean;
    onChange: () => void;
}

export default function EpisodeViewToggle({ episodes, showTitles, onChange }: EpisodeViewToggleProps) {
    if (!episodes.some((episode) => getEpisodeTitle(episode))) return null;
    const label = showTitles ? '切换为集数方块视图' : '切换为标题列表视图';

    return (
        <Tooltip title={label} disableTouchListener>
            <ToggleButton
                value="titles"
                selected={showTitles}
                onChange={onChange}
                aria-label={label}
                sx={{ display: { xs: 'inline-flex', sm: 'none' }, width: 44, height: 44, flexShrink: 0, borderRadius: 1.5 }}
            >
                {showTitles ? <GridViewIcon fontSize="small" /> : <ViewListIcon fontSize="small" />}
            </ToggleButton>
        </Tooltip>
    );
}
