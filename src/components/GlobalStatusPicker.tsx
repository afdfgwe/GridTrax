/* eslint-disable react-refresh/only-export-components */
import { Box, Rating, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import type { WatchStatus } from '../types';
import { STATUS_LABELS } from '../types';

interface GlobalStatusPickerProps {
    status?: WatchStatus;
    rating: number;
    onStatusChange: (status: WatchStatus) => void;
    onRatingChange: (rating: number) => void;
}

const STATUSES: WatchStatus[] = ['Wish', 'Do', 'Collect', 'OnHold', 'Dropped'];

// SVG icon components for each status (16×16 viewBox)
export const StatusIcons: Record<WatchStatus, React.ReactElement> = {
    Wish: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z" />
        </svg>
    ),
    Do: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z" />
        </svg>
    ),
    Collect: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
    ),
    OnHold: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
    ),
    Dropped: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
    ),
};

const GlobalStatusPicker: React.FC<GlobalStatusPickerProps> = ({
    status,
    rating,
    onStatusChange,
    onRatingChange,
}) => {
    const theme = useTheme();
    const primary = theme.palette.primary.main;
    const [hoverRating, setHoverRating] = React.useState<number | null>(null);
    const displayScore = hoverRating ?? (rating > 0 ? rating : null);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Status Chips */}
            <ToggleButtonGroup
                value={status}
                exclusive
                onChange={(_, val) => val && onStatusChange(val as WatchStatus)}
                size="small"
                sx={{
                    flexWrap: 'wrap',
                    gap: 0.5,
                    '& .MuiToggleButtonGroup-grouped': {
                        border: 'none !important',
                        borderRadius: '20px !important',
                        mx: 0,
                    },
                }}
            >
                {STATUSES.map((s) => (
                    <ToggleButton
                        key={s}
                        value={s}
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            gap: 0.6,
                            color: status === s ? '#000' : 'text.secondary',
                            background: status === s ? primary : alpha(primary, 0.1),
                            '&.Mui-selected': {
                                background: primary,
                                color: '#000',
                                '&:hover': { background: alpha(primary, 0.85) },
                            },
                            '&:hover': {
                                background: alpha(primary, 0.2),
                            },
                            transition: 'all 150ms ease',
                        }}
                    >
                        {StatusIcons[s]} {STATUS_LABELS[s]}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {/* 10-star Rating */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Rating
                    max={10}
                    value={rating}
                    onChange={(_, val) => onRatingChange(val ?? 0)}
                    onChangeActive={(_, val) => setHoverRating(val > 0 ? val : null)}
                    size="small"
                    sx={{
                        '& .MuiRating-iconFilled': { color: primary },
                        '& .MuiRating-iconHover': { color: alpha(primary, 0.7) },
                    }}
                />
                {displayScore && (
                    <Typography
                        variant="caption"
                        sx={{
                            color: hoverRating ? 'text.primary' : primary,
                            fontWeight: 700,
                            minWidth: 36,
                            transition: 'color 150ms ease',
                        }}
                    >
                        {displayScore}/10
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default GlobalStatusPicker;
