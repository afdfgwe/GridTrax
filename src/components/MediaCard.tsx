import StarIcon from '@mui/icons-material/Star';
import {
    Box,
    Card,
    CardContent,
    CardMedia,
    Chip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { getPosterUrl } from '../api/tmdb';
import type { TMDBSearchResult } from '../types';

interface MediaCardProps {
    item: TMDBSearchResult;
    onClick: (item: TMDBSearchResult) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onClick }) => {
    const title = item.name ?? item.title ?? '未知作品';
    const year = (item.first_air_date ?? item.release_date ?? '').slice(0, 4);
    const score = item.vote_average?.toFixed(1) ?? '?';
    const isTV = item.media_type === 'tv';

    const theme = useTheme();
    // On touch/coarse-pointer devices (mobile), only the title should navigate
    const isTouchDevice = useMediaQuery('(pointer: coarse)');

    return (
        <Card
            onClick={isTouchDevice ? undefined : () => onClick(item)}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'background.paper',
                transition: 'transform 200ms ease, box-shadow 200ms ease',
                cursor: isTouchDevice ? 'default' : 'pointer',
                '&:hover': isTouchDevice ? {} : {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                },
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            {/* Poster */}
            <Box sx={{ position: 'relative' }}>
                <CardMedia
                    component="img"
                    image={getPosterUrl(item.poster_path, 'w342')}
                    alt={title}
                    sx={{
                        aspectRatio: '2/3',
                        objectFit: 'cover',
                        backgroundColor: alpha('#fff', 0.05),
                    }}
                />
                {/* Score badge */}
                {(item.vote_average ?? 0) > 0 && (
                    <Chip
                        icon={<StarIcon sx={{ color: '#FFD54F !important', fontSize: '14px' }} />}
                        label={score}
                        size="small"
                        sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: alpha('#000', 0.7),
                            color: '#FFD54F',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            backdropFilter: 'blur(4px)',
                        }}
                    />
                )}
                {/* Type badge */}
                <Chip
                    label={isTV ? '剧集' : '电影'}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        backgroundColor: alpha(isTV ? '#D0BCFF' : '#80CBC4', 0.85),
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                    }}
                />
            </Box>

            {/* Info */}
            <CardContent sx={{ flex: 1, pb: '12px !important' }}>
                <Typography
                    variant="body2"
                    fontWeight={700}
                    noWrap
                    title={title}
                    onClick={isTouchDevice ? () => onClick(item) : undefined}
                    sx={{
                        // On mobile: make the title clearly tappable
                        ...(isTouchDevice && {
                            cursor: 'pointer',
                            color: theme.palette.primary.light,
                            textDecorationLine: 'underline',
                            textDecorationColor: alpha(theme.palette.primary.light, 0.4),
                            textUnderlineOffset: '3px',
                        }),
                    }}
                >
                    {title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {year}
                </Typography>
            </CardContent>
        </Card>
    );
};

export default MediaCard;
