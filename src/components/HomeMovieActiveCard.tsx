import { Box, Card, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosterUrl } from '../api/tmdb';
import { useProgressStore } from '../store/useProgressStore';
import HomeQuickEdit from './HomeQuickEdit';

interface HomeMovieActiveCardProps {
    movieId: number;
    name?: string;
    posterPath?: string;
}

const HomeMovieActiveCard: React.FC<HomeMovieActiveCardProps> = ({
    movieId,
    name,
    posterPath,
}) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { getMovieRecord } = useProgressStore();
    const record = getMovieRecord(movieId);

    const primary = theme.palette.primary.main;
    const titleText = name || `电影 ID: ${movieId}`;
    const poster = posterPath ? getPosterUrl(posterPath, 'w154') : undefined;
    const meta = { name, poster_path: posterPath };

    return (
        <Card
            sx={{
                display: 'flex',
                flexDirection: 'column',
                mb: 3,
                borderRadius: 2,
                backgroundColor: alpha(primary, 0.03),
                border: `1px solid ${alpha(primary, 0.1)}`,
                transition: 'box-shadow 0.2s ease',
                '&:hover': {
                    boxShadow: `0 4px 20px ${alpha(primary, 0.1)}`,
                }
            }}
        >
            <Box sx={{ display: 'flex', p: 2 }}>
                {/* Poster */}
                <Box
                    sx={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => navigate(`/movie/${movieId}`)}
                >
                    {poster ? (
                        <Box
                            component="img"
                            src={poster}
                            alt={titleText}
                            sx={{ width: { xs: 64, sm: 80 }, aspectRatio: '2/3', height: 'auto', borderRadius: 1.5, objectFit: 'cover', mr: 2 }}
                        />
                    ) : (
                        <Box sx={{
                            width: { xs: 64, sm: 80 }, aspectRatio: '2/3', height: 'auto', borderRadius: 1.5, mr: 2,
                            backgroundColor: alpha(primary, 0.1),
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Typography variant="caption" color="primary">No Poster</Typography>
                        </Box>
                    )}
                </Box>

                {/* Info */}
                <Box
                    sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={() => navigate(`/movie/${movieId}`)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" fontWeight={700}>{titleText}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">电影 · 在看</Typography>
                        {record?.rating ? (
                            <Typography variant="body2" sx={{ color: primary, fontWeight: 700 }}>
                                ★ {record.rating}/10
                            </Typography>
                        ) : null}
                    </Box>
                </Box>

                {/* Quick Edit */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 0.5 }}>
                    <HomeQuickEdit
                        recordKey={`movie_${movieId}`}
                        type="movie"
                        tmdbId={movieId}
                        meta={meta}
                    />
                </Box>
            </Box>
        </Card>
    );
};

export default HomeMovieActiveCard;
