import {Box, Card, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import HomeQuickEdit from './HomeQuickEdit';
import PosterScoreBadge from './PosterScoreBadge';

interface HomeMovieActiveCardProps {
    movieId: number;
    name?: string;
    posterPath?: string;
    score?: number;
    year?: string;
}

/** 首页“在看”电影卡片；电影没有分集进度，仅保留元数据和状态快捷编辑。 */
const HomeMovieActiveCard: React.FC<HomeMovieActiveCardProps> = ({
                                                                     movieId,
                                                                     name,
                                                                     posterPath,
                                                                     score,
                                                                     year,
                                                                 }) => {
    const theme = useTheme();
    const navigate = useNavigate();

    const primary = theme.palette.primary.main;
    const titleText = name || `电影 ID: ${movieId}`;
    const poster = posterPath ? getPosterUrl(posterPath, 'w154') : undefined;
    const meta = {name, poster_path: posterPath};

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
            <Box sx={{display: 'flex', p: 2}}>
                {/* 点击海报进入电影详情；评分徽标不单独拦截点击。 */}
                <Box
                    sx={{
                        cursor: 'pointer',
                        flexShrink: 0,
                        position: 'relative',
                        width: {xs: 64, sm: 80},
                        height: {xs: 96, sm: 120},
                        mr: 2
                    }}
                    onClick={() => navigate(`/movie/${movieId}`)}
                >
                    {poster ? (
                        <Box
                            component="img"
                            src={poster}
                            alt={titleText}
                            sx={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                borderRadius: 1.5,
                                objectFit: 'cover'
                            }}
                        />
                    ) : (
                        <Box sx={{
                            width: '100%', height: '100%', borderRadius: 1.5,
                            backgroundColor: alpha(primary, 0.1),
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Typography variant="caption" color="primary">No Poster</Typography>
                        </Box>
                    )}
                    {poster && <PosterScoreBadge score={score}/>}
                </Box>

                {/* 电影名称和上映年份，信息区域同样支持进入详情。 */}
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/movie/${movieId}`)}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5}}>
                        <Typography variant="h6" fontWeight={700}>{titleText}</Typography>
                    </Box>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Typography variant="body2" color="text.secondary">
                            电影 · 在看{year ? ` · ${year}年` : ''}
                        </Typography>
                    </Box>
                </Box>

                {/* 快捷编辑与详情导航独立，避免编辑时同时跳转。 */}
                <Box sx={{display: 'flex', alignItems: 'flex-start', pt: 0.5}}>
                    <HomeQuickEdit
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
