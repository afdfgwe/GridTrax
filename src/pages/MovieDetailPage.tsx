import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StarIcon from '@mui/icons-material/Star';
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Container,
    IconButton,
    Skeleton,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBackdropUrl, getMovie, getPosterUrl } from '../api/tmdb';
import GlobalStatusPicker from '../components/GlobalStatusPicker';
import { useProgressStore } from '../store/useProgressStore';
import type { TMDBMovie, WatchStatus } from '../types';

const MovieDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [movie, setMovie] = useState<TMDBMovie | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showComment, setShowComment] = useState(false);
    const theme = useTheme();

    const {
        ensureMovieRecord,
        getMovieRecord,
        setMovieStatus,
        setMovieRating,
        setMovieComment,
    } = useProgressStore();

    useEffect(() => {
        if (!id) return;
        queueMicrotask(() => setLoading(true));
        getMovie(Number(id))
            .then((m) => {
                setMovie(m);
                ensureMovieRecord(m.id, { name: m.title, poster_path: m.poster_path });
            })
            .catch(() => setError('加载失败，请刷新重试。'))
            .finally(() => setLoading(false));
    }, [id, ensureMovieRecord]);

    const primary = theme.palette.primary.main;

    const record = movie ? getMovieRecord(movie.id) : undefined;

    return (
        <React.Fragment>
            <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
                {/* Backdrop */}
                <Box sx={{ position: 'relative', height: { xs: 220, sm: 300, md: 380 }, overflow: 'hidden', mb: -6, backgroundColor: 'background.paper' }}>
                    {movie?.backdrop_path ? (
                        <Box
                            component="img"
                            src={getBackdropUrl(movie.backdrop_path)}
                            alt=""
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4)' }}
                        />
                    ) : (
                        <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />
                    )}
                    <Box
                        sx={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: '80%',
                            background: `linear-gradient(to bottom, transparent, ${theme.palette.background.default})`,
                        }}
                    />
                    <IconButton
                        onClick={() => navigate(-1)}
                        sx={{
                            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: 16,
                            backgroundColor: alpha('#000', 0.5), color: '#fff',
                            '&:hover': { backgroundColor: alpha('#000', 0.7) },
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                </Box>

                <Container maxWidth="lg" sx={{ pt: 6, pb: 8, overflow: 'visible' }}>
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
                    ) : movie ? (
                        <>
                            {/* Movie Header */}
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 }, mb: 4, alignItems: { xs: 'center', sm: 'flex-start' } }}>
                                <Box
                                    component="img"
                                    src={getPosterUrl(movie.poster_path, 'w342')}
                                    alt={movie.title}
                                    sx={{
                                        width: { xs: 160, sm: 150 },
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
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h4" fontWeight={800} gutterBottom sx={{ lineHeight: 1.2 }}>
                                        {movie.title}
                                    </Typography>
                                    {movie.original_title !== movie.title && (
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {movie.original_title}
                                        </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                                        <Chip
                                            icon={<StarIcon sx={{ fontSize: '14px !important', color: '#FFD54F !important' }} />}
                                            label={movie.vote_average.toFixed(1)}
                                            size="small"
                                            sx={{ backgroundColor: alpha('#FFD54F', 0.15), color: '#FFD54F', fontWeight: 700 }}
                                        />
                                        <Chip
                                            label={movie.release_date?.slice(0, 4)}
                                            size="small"
                                            sx={{ backgroundColor: alpha(primary, 0.15), color: primary }}
                                        />
                                        {movie.runtime && (
                                            <Chip
                                                label={`${movie.runtime} 分钟`}
                                                size="small"
                                                sx={{ backgroundColor: alpha(primary, 0.15), color: primary }}
                                            />
                                        )}
                                        {movie.genres.slice(0, 3).map((g) => (
                                            <Chip
                                                key={g.id}
                                                label={g.name}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderColor: alpha(primary, 0.4), color: 'text.secondary' }}
                                            />
                                        ))}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {movie.overview || '暂无简介'}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Status & Rating */}
                            <Box
                                sx={{
                                    p: 3,
                                    borderRadius: 2,
                                    backgroundColor: alpha(primary, 0.06),
                                    border: `1px solid ${alpha(primary, 0.15)}`,
                                    mb: 2,
                                }}
                            >
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    观看状态 & 评分
                                </Typography>
                                {record && (
                                    <GlobalStatusPicker
                                        status={record.global_status || 'Wish'}
                                        rating={record.rating}
                                        onStatusChange={(s: WatchStatus) => setMovieStatus(movie.id, s, { name: movie.title, poster_path: movie.poster_path })}
                                        onRatingChange={(r) => setMovieRating(movie.id, r)}
                                    />
                                )}
                            </Box>

                            {/* Comment */}
                            <Box>
                                <Button
                                    size="small"
                                    startIcon={<ChatBubbleOutlineIcon />}
                                    onClick={() => setShowComment(!showComment)}
                                    sx={{ color: 'text.secondary', textTransform: 'none' }}
                                >
                                    {showComment ? '收起' : '发表'} 观后感
                                    {record?.global_comment && ' (已有评论)'}
                                </Button>
                                <Collapse in={showComment}>
                                    <TextField
                                        multiline
                                        minRows={3}
                                        maxRows={8}
                                        fullWidth
                                        placeholder="写下对这部电影的感想…"
                                        value={record?.global_comment ?? ''}
                                        onChange={(e) => movie && setMovieComment(movie.id, e.target.value)}
                                        sx={{ mt: 1 }}
                                    />
                                </Collapse>
                            </Box>
                        </>
                    ) : null}
                </Container>
            </Box>
        </React.Fragment>
    );
};

export default MovieDetailPage;
