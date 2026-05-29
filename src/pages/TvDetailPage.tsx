import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    IconButton,
    Skeleton,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBackdropUrl, getPosterUrl, getTVShow } from '../api/tmdb';
import SeasonBlock from '../components/SeasonBlock';
import type { TMDBTVShow } from '../types';

const TvDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [show, setShow] = useState<TMDBTVShow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedOverview, setExpandedOverview] = useState(false);

    useEffect(() => {
        if (!id) return;
        let isMounted = true;
        queueMicrotask(() => {
            if (isMounted) setLoading(true);
        });
        getTVShow(Number(id))
            .then(data => {
                if (isMounted) setShow(data);
            })
            .catch(() => {
                if (isMounted) setError('加载失败，请刷新重试。');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
            
        return () => {
            isMounted = false;
        };
    }, [id]);

    const theme = useTheme();
    const primary = theme.palette.primary.main;

    const backdropUrl = show?.backdrop_path ? getBackdropUrl(show.backdrop_path) : '';

    // Filter out specials (season 0) but keep them if the show only has specials
    const regularSeasons = show?.seasons.filter((s) => s.season_number > 0) ?? [];

    return (
        <React.Fragment>
            <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
                {/* Backdrop Hero */}
                <Box
                    sx={{
                        position: 'relative',
                        height: { xs: 220, sm: 300, md: 380 },
                        overflow: 'hidden',
                        mb: -6,
                    }}
                >
                    {backdropUrl && (
                        <Box
                            component="img"
                            src={backdropUrl}
                            alt=""
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'brightness(0.4)',
                            }}
                        />
                    )}
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '80%',
                            background: `linear-gradient(to bottom, transparent, ${theme.palette.background.default})`,
                        }}
                    />
                    {/* Back button */}
                    <IconButton
                        onClick={() => navigate(-1)}
                        sx={{
                            position: 'absolute',
                            top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                            left: 16,
                            backgroundColor: alpha('#000', 0.5),
                            color: '#fff',
                            '&:hover': { backgroundColor: alpha('#000', 0.7) },
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                </Box>

                <Container maxWidth="lg" sx={{ pt: 6, pb: 8, position: 'relative' }}>
                    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                    {loading ? (
                        <Box sx={{ display: 'flex', gap: 3 }}>
                            <Skeleton variant="rounded" width={140} height={210} sx={{ borderRadius: 1.5, flexShrink: 0 }} />
                            <Box sx={{ flex: 1 }}>
                                <Skeleton variant="text" width="60%" height={40} />
                                <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1 }} />
                                <Skeleton variant="rounded" height={80} />
                            </Box>
                        </Box>
                    ) : show ? (
                        <>
                            {/* Show Header */}
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 }, mb: 4, alignItems: { xs: 'center', sm: 'flex-start' } }}>
                                {/* Poster */}
                                <Box
                                    component="img"
                                    src={getPosterUrl(show.poster_path, 'w342')}
                                    alt={show.name}
                                    sx={{
                                        width: { xs: 160, sm: 140 },
                                        maxWidth: { xs: '55vw', sm: 'none' },
                                        aspectRatio: '2/3',
                                        objectFit: 'cover',
                                        borderRadius: 2,
                                        boxShadow: `0 8px 32px ${alpha(primary, 0.4)}`,
                                        flexShrink: 0,
                                        mt: -4,
                                        position: 'relative',
                                        zIndex: 2,
                                    }}
                                />
                                {/* Info */}
                                <Box sx={{ flex: 1, pt: { xs: 0, sm: 1 } }}>
                                    <Typography variant="h4" fontWeight={800} gutterBottom sx={{ lineHeight: 1.2 }}>
                                        {show.name}
                                    </Typography>
                                    {show.original_name !== show.name && (
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {show.original_name}
                                        </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                                        <Chip
                                            icon={<StarIcon sx={{ fontSize: '14px !important', color: '#FFD54F !important' }} />}
                                            label={show.vote_average.toFixed(1)}
                                            size="small"
                                            sx={{ backgroundColor: alpha('#FFD54F', 0.15), color: '#FFD54F', fontWeight: 700 }}
                                        />
                                        <Chip
                                            label={show.first_air_date?.slice(0, 4)}
                                            size="small"
                                            sx={{ backgroundColor: alpha(primary, 0.15), color: primary }}
                                        />
                                        <Chip
                                            label={`${show.number_of_seasons} 季 · ${show.number_of_episodes} 集`}
                                            size="small"
                                            sx={{ backgroundColor: alpha(primary, 0.15), color: primary }}
                                        />
                                        {show.genres.slice(0, 3).map((g) => (
                                            <Chip
                                                key={g.id}
                                                label={g.name}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderColor: alpha(primary, 0.4), color: 'text.secondary' }}
                                            />
                                        ))}
                                    </Box>
                                    <Box sx={{ position: 'relative' }}>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                display: expandedOverview ? 'block' : '-webkit-box',
                                                WebkitLineClamp: expandedOverview ? 'unset' : 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                transition: 'all 0.3s ease',
                                            }}
                                        >
                                            {show.overview || '暂无简介'}
                                        </Typography>
                                        {show.overview && show.overview.length > 100 && (
                                            <Button
                                                size="small"
                                                onClick={() => setExpandedOverview(!expandedOverview)}
                                                sx={{ p: 0, minWidth: 'auto', fontSize: '0.75rem', mt: 0.5, textTransform: 'none' }}
                                            >
                                                {expandedOverview ? '收起' : '展开阅读'}
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                            </Box>

                            {/* Season Blocks */}
                            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: primary }}>
                                全部季数
                            </Typography>
                            {regularSeasons.map((season, idx) => (
                                <SeasonBlock
                                    key={season.id}
                                    tvId={show.id}
                                    showName={show.name}
                                    seasonSummary={season}
                                    defaultExpanded={idx === 0}
                                />
                            ))}
                        </>
                    ) : null}
                </Container>
            </Box>
        </React.Fragment>
    );
};

export default TvDetailPage;
