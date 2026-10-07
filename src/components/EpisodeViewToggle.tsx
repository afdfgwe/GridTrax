import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import { IconButton, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { TMDBEpisode } from '../types';
import { getEpisodeTitle } from './episodeTitle';

interface EpisodeViewToggleProps {
    episodes: TMDBEpisode[];
    showTitles: boolean;
    onChange: () => void;
}

export default function EpisodeViewToggle({ episodes, showTitles, onChange }: EpisodeViewToggleProps) {
    const theme = useTheme();
    const primary = theme.palette.primary.main;
    if (!episodes.some((episode) => getEpisodeTitle(episode))) return null;
    const label = showTitles ? '切换为集数方块视图' : '切换为标题列表视图';

    return (
        <Tooltip title={label} disableTouchListener>
            <IconButton
                size="small"
                aria-pressed={showTitles}
                onClick={onChange}
                aria-label={label}
                sx={{
                    display: { xs: 'inline-flex', sm: 'none' },
                    flexShrink: 0,
                    border: `1px solid ${alpha(primary, showTitles ? 0.45 : 0.2)}`,
                    borderRadius: 1.5,
                    color: showTitles ? primary : 'text.secondary',
                    backgroundColor: showTitles ? alpha(primary, 0.08) : 'transparent',
                }}
            >
                {showTitles ? <GridViewIcon fontSize="small" /> : <ViewListIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    );
}
