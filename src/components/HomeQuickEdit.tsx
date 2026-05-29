import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Rating,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useProgressStore } from '../store/useProgressStore';
import { STATUS_LABELS, type WatchStatus } from '../types';
import { StatusIcons } from './GlobalStatusPicker';

interface HomeQuickEditProps {
    recordKey: string; // e.g. 'tv_season' or 'movie'
    type: 'tv_season' | 'movie';
    tmdbId: number;
    seasonNumber?: number;
    meta?: {
        name?: string;
        show_name?: string;
        poster_path?: string;
        episode_count?: number;
    };
}



const STATUSES: WatchStatus[] = ['Wish', 'Do', 'Collect', 'OnHold', 'Dropped'];

const HomeQuickEdit: React.FC<HomeQuickEditProps> = ({
    type,
    tmdbId,
    seasonNumber,
    meta,
}) => {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);
    const [hoverRating, setHoverRating] = React.useState<number | null>(null);

    const {
        getSeasonRecord,
        getMovieRecord,
        setSeasonStatus,
        setSeasonRating,
        setMovieStatus,
        setMovieRating,
        removeRecord,
    } = useProgressStore();

    const record = type === 'tv_season' && seasonNumber !== undefined
        ? getSeasonRecord(tmdbId, seasonNumber)
        : type === 'movie'
            ? getMovieRecord(tmdbId)
            : undefined;

    const currentStatus = record?.global_status;
    const currentRating = record?.rating ?? 0;
    const displayScore = hoverRating ?? (currentRating > 0 ? currentRating : null);
    const primary = theme.palette.primary.main;

    const handleStatusChange = (_: React.MouseEvent, val: string | null) => {
        if (!val) return;
        const status = val as WatchStatus;
        if (type === 'tv_season' && seasonNumber !== undefined) {
            setSeasonStatus(tmdbId, seasonNumber, status, meta);
        } else if (type === 'movie') {
            setMovieStatus(tmdbId, status, { name: meta?.name, poster_path: meta?.poster_path });
        }
    };

    const handleRatingChange = (_: React.SyntheticEvent, val: number | null) => {
        const r = val ?? 0;
        if (type === 'tv_season' && seasonNumber !== undefined) {
            setSeasonRating(tmdbId, seasonNumber, r);
        } else if (type === 'movie') {
            setMovieRating(tmdbId, r);
        }
    };

    const titleText = meta?.show_name || meta?.name || (type === 'tv_season' ? `剧集 #${tmdbId}` : `电影 #${tmdbId}`);
    const tagText = type === 'tv_season' ? (meta?.name || `第 ${seasonNumber} 季`) : null;
    const currentRecordKey = type === 'tv_season' ? `tmdb_tv_${tmdbId}_s${seasonNumber}` : `tmdb_movie_${tmdbId}`;

    const handleDelete = () => {
        if (window.confirm(`确定要从 GridTrax 中删除「${titleText}」的所有记录吗？此操作无法撤销。`)) {
            removeRecord(currentRecordKey);
            setOpen(false);
        }
    };

    return (
        <>
            <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                sx={{
                    color: 'text.secondary',
                    '&:hover': { color: primary, backgroundColor: alpha(primary, 0.1) },
                }}
            >
                <EditIcon fontSize="small" />
            </IconButton>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        backgroundColor: 'background.paper',
                    },
                }}
            >
                <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography fontWeight={700} variant="subtitle1">{titleText}</Typography>
                        {tagText && tagText !== titleText && (
                            <Typography
                                component="span"
                                sx={{
                                    backgroundColor: primary,
                                    color: theme.palette.getContrastText(primary),
                                    px: 0.75,
                                    py: 0.2,
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                }}
                            >
                                {tagText}
                            </Typography>
                        )}
                    </Box>
                    <IconButton
                        size="small"
                        onClick={handleDelete}
                        sx={{
                            color: 'text.secondary',
                            mt: -0.5,
                            mr: -1,
                            '&:hover': { color: 'error.main', backgroundColor: alpha(theme.palette.error.main, 0.1) },
                        }}
                        title="从追踪列表中删除"
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>

                <DialogContent>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        观看状态
                    </Typography>
                    <ToggleButtonGroup
                        value={currentStatus ?? null}
                        exclusive
                        onChange={handleStatusChange}
                        size="small"
                        sx={{
                            flexWrap: 'wrap',
                            gap: 0.5,
                            mb: 2,
                            '& .MuiToggleButtonGroup-grouped': {
                                border: 'none !important',
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
                                    borderRadius: '8px !important',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    gap: 0.6,
                                    color: currentStatus === s ? '#000' : 'text.secondary',
                                    background: currentStatus === s ? primary : alpha(primary, 0.1),
                                    '&.Mui-selected': {
                                        background: primary,
                                        color: theme.palette.getContrastText(primary),
                                        '&:hover': { background: alpha(primary, 0.85) },
                                    },
                                    '&:hover': { background: alpha(primary, 0.2) },
                                }}
                            >
                                {StatusIcons[s]} {STATUS_LABELS[s]}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        评分
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Rating
                            max={10}
                            value={currentRating}
                            onChange={handleRatingChange}
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
                </DialogContent>
            </Dialog>
        </>
    );
};

export default HomeQuickEdit;
