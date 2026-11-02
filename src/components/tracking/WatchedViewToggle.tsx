import GridViewIcon from '@mui/icons-material/GridView';
import TimelineIcon from '@mui/icons-material/Timeline';
import {ToggleButton, ToggleButtonGroup, Tooltip} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';

interface WatchedViewToggleProps {
    view: 'grid' | 'timeline';
    onChange: (view: 'grid' | 'timeline') => void;
}

/** 两种看过视图共用的紧凑切换入口，保持当前模式选中且不允许取消选择。 */
export default function WatchedViewToggle({view, onChange}: WatchedViewToggleProps) {
    const theme = useTheme();
    const primary = theme.palette.primary.main;

    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            aria-label="看过展示方式"
            onChange={(_, next: 'grid' | 'timeline' | null) => {
                if (next) onChange(next);
            }}
            sx={{
                height: 24, flexShrink: 0, '& .MuiToggleButton-root': {
                    width: 26, p: 0.25, color: 'text.secondary', borderColor: alpha(primary, 0.15),
                    '&.Mui-selected': {
                        color: primary, backgroundColor: alpha(primary, 0.12),
                        '&:hover': {backgroundColor: alpha(primary, 0.18)}
                    },
                }
            }}
        >
            <Tooltip title="网格视图" disableTouchListener>
                <ToggleButton value="grid" aria-label="网格视图"><GridViewIcon sx={{fontSize: 14}}/></ToggleButton>
            </Tooltip>
            <Tooltip title="时间线视图" disableTouchListener>
                <ToggleButton value="timeline" aria-label="时间线视图"><TimelineIcon sx={{fontSize: 14}}/></ToggleButton>
            </Tooltip>
        </ToggleButtonGroup>
    );
}
