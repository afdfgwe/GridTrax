import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React from 'react';
import {useProgressStore} from '../store/useProgressStore';
import {STATUS_LABELS, type WatchStatus} from '../types';
import {StatusIcons} from './GlobalStatusPicker';

interface HomeQuickEditProps {
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


// 可切换的观看状态，顺序与全局状态选择器保持一致。
const STATUSES: WatchStatus[] = ['Wish', 'Do', 'Collect', 'OnHold', 'Dropped'];

/** 首页卡片的轻量编辑弹窗：切换观看状态或删除当前电影／当前季记录。 */
const HomeQuickEdit: React.FC<HomeQuickEditProps> = ({
                                                         type,
                                                         tmdbId,
                                                         seasonNumber,
                                                         meta,
                                                     }) => {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);

    const setSeasonStatus = useProgressStore((state) => state.setSeasonStatus);
    const setMovieStatus = useProgressStore((state) => state.setMovieStatus);
    const removeRecord = useProgressStore((state) => state.removeRecord);

    // 电视剧按季取记录，电影按作品取记录，二者使用各自的存储动作。
    const record = useProgressStore((state) => state.data.records[type === 'tv_season'
        ? `tmdb_tv_${tmdbId}_s${seasonNumber}` : `tmdb_movie_${tmdbId}`]);

    const currentStatus = record?.global_status;
    const primary = theme.palette.primary.main;

    const handleStatusChange = (_: React.MouseEvent, val: string | null) => {
        // 单选按钮再次点击当前项会返回空值，此处不将其解释为清除观看状态。
        if (!val) return;
        const status = val as WatchStatus;
        if (type === 'tv_season' && seasonNumber !== undefined) {
            setSeasonStatus(tmdbId, seasonNumber, status, meta);
        } else if (type === 'movie') {
            setMovieStatus(tmdbId, status, {name: meta?.name, poster_path: meta?.poster_path});
        }
    };

    const titleText = meta?.show_name || meta?.name || (type === 'tv_season' ? `剧集 #${tmdbId}` : `电影 #${tmdbId}`);
    const tagText = type === 'tv_season' ? (meta?.name || `第 ${seasonNumber} 季`) : null;
    // 必须与进度存储的键格式一致；删除一季不会连带删除同一部剧的其他季。
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
                onClick={(e) => {
                    // 阻止事件冒泡到卡片的详情跳转入口。
                    e.stopPropagation();
                    setOpen(true);
                }}
                sx={{
                    color: 'text.secondary',
                    '&:hover': {color: primary, backgroundColor: alpha(primary, 0.1)},
                }}
            >
                <EditIcon fontSize="small"/>
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
                <DialogTitle
                    sx={{pb: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1}}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
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
                            '&:hover': {color: 'error.main', backgroundColor: alpha(theme.palette.error.main, 0.1)},
                        }}
                        title="从追踪列表中删除"
                    >
                        <DeleteIcon fontSize="small"/>
                    </IconButton>
                </DialogTitle>

                <DialogContent>
                    <Typography variant="caption" color="text.secondary" sx={{mb: 1, display: 'block'}}>
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
                                        '&:hover': {background: alpha(primary, 0.85)},
                                    },
                                    '&:hover': {background: alpha(primary, 0.2)},
                                }}
                            >
                                {StatusIcons[s]} {STATUS_LABELS[s]}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                </DialogContent>
            </Dialog>
        </>
    );
};

export default HomeQuickEdit;
