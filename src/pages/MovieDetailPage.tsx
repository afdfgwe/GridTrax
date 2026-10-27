import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import StarIcon from '@mui/icons-material/Star';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    Chip,
    Container,
    IconButton,
    Skeleton,
    Typography,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useCallback, useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getBackdropUrl, getMovie, getPosterUrl} from '../api/tmdb';
import GlobalStatusPicker from '../components/GlobalStatusPicker';
import ExpandableOverview from '../components/ExpandableOverview';
import ProductionInfo from '../components/ProductionInfo';
import MediaCredits from '../components/MediaCredits';
import MediaImageGallery from '../components/MediaImageGallery';
import MediaRecommendations from '../components/MediaRecommendations';
import {useProgressStore} from '../store/useProgressStore';
import type {MovieRecord, WatchStatus} from '../types';
import {useAsyncResource} from '../hooks/useAsyncResource';

/** 电影详情：展示接口信息，并通过状态选择器维护本地观影记录。 */
const MovieDetailPage: React.FC = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const load = useCallback(() => getMovie(Number(id)), [id]);
    const {data: movie, loading, error, retry} = useAsyncResource(`movie:${id}`, load);
    const theme = useTheme();
    const [posterOpenId, setPosterOpenId] = useState<number | null>(null);

    const ensureMovieRecord = useProgressStore((state) => state.ensureMovieRecord);
    const setMovieStatus = useProgressStore((state) => state.setMovieStatus);
    const record = useProgressStore((state) => state.data.records[`tmdb_movie_${id}`] as MovieRecord | undefined);

    // 路由编号变化时加载电影，并同步名称、海报等可供首页使用的展示元数据。
    useEffect(() => {
        // 仅确保记录和元数据存在；新记录没有观看状态，不会自动加入追踪列表。
        if (movie) ensureMovieRecord(movie.id, {name: movie.title, poster_path: movie.poster_path});
    }, [movie, ensureMovieRecord]);

    const primary = theme.palette.primary.main;
    const releaseYear = movie?.release_date?.trim().slice(0, 4);
    const tagline = movie?.tagline?.trim();

    // 接口评分与年份等信息来自 movie，观看状态来自浏览器中的 record。

    return (
        <React.Fragment>
            <Box sx={{minHeight: '100vh', backgroundColor: theme.palette.background.default}}>
                {/* 电影背景图，按屏幕尺寸裁剪展示。 */}
                <Box sx={{
                    position: 'relative',
                    height: {xs: 220, sm: 300, md: 380},
                    overflow: 'hidden',
                    mb: -6,
                    backgroundColor: 'background.paper'
                }}>
                    {movie?.backdrop_path ? (
                        <Box
                            component="img"
                            src={getBackdropUrl(movie.backdrop_path)}
                            alt=""
                            sx={{width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4)'}}
                        />
                    ) : loading ? (
                        <Skeleton variant="rectangular" width="100%" height="100%" animation="wave"/>
                    ) : null}
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
                            '&:hover': {backgroundColor: alpha('#000', 0.7)},
                        }}
                    >
                        <ArrowBackIcon/>
                    </IconButton>
                </Box>

                <Container maxWidth="lg" sx={{pt: 6, pb: 8, overflow: 'visible'}}>
                    {error && <Alert severity="error" sx={{mb: 3}} action={<Button color="inherit" size="small"
                                                                                   onClick={retry}>重试</Button>}>{error}</Alert>}

                    {loading ? (
                        <Box sx={{display: 'flex', gap: 3}}>
                            <Skeleton variant="rounded" width={140} height={210}
                                      sx={{borderRadius: 1.5, flexShrink: 0}}/>
                            <Box sx={{flex: 1}}>
                                <Skeleton variant="text" width="60%" height={40}/>
                                <Skeleton variant="text" width="30%" height={24} sx={{mb: 1}}/>
                                <Skeleton variant="rounded" height={80}/>
                            </Box>
                        </Box>
                    ) : movie ? (
                        <>
                            {/* 电影海报和 TMDB 返回的名称、评分、上映日期等概要。 */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: {xs: 'column', sm: 'row'},
                                gap: {xs: 2, sm: 3},
                                alignItems: {xs: 'center', sm: 'flex-start'}
                            }}>
                                <ButtonBase
                                    disabled={!movie.poster_path}
                                    aria-label={`查看${movie.title}的海报相册`}
                                    onClick={() => setPosterOpenId(movie.id)}
                                    sx={{
                                        width: {xs: 160, sm: 150},
                                        maxWidth: {xs: '55vw', sm: 'none'},
                                        aspectRatio: '2/3',
                                        objectFit: 'cover',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: `0 8px 32px ${alpha(primary, 0.4)}`,
                                        flexShrink: 0,
                                        mt: -4,
                                        position: 'relative',
                                        zIndex: 2,
                                    }}
                                >
                                    <Box component="img" src={getPosterUrl(movie.poster_path, 'w342')} alt={movie.title}
                                         sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                                </ButtonBase>
                                <Box sx={{flex: 1, minWidth: 0, width: {xs: '100%', sm: 'auto'}}}>
                                    <Typography variant="h4" fontWeight={800} gutterBottom sx={{lineHeight: 1.2}}>
                                        {movie.title}
                                    </Typography>
                                    {movie.original_title !== movie.title && (
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {movie.original_title}
                                        </Typography>
                                    )}
                                    {tagline && (
                                        <Box component="blockquote" sx={{
                                            m: 0, mb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.75,
                                        }}>
                                            <FormatQuoteIcon aria-hidden="true" sx={{
                                                fontSize: 22, color: 'primary.main', flexShrink: 0, mt: 0.125,
                                                transform: 'rotate(180deg)',
                                            }}/>
                                            <Typography variant="body1" color="text.secondary" sx={{
                                                minWidth: 0, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 500,
                                                whiteSpace: 'pre-line', overflowWrap: 'anywhere',
                                            }}>
                                                {tagline}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5}}>
                                        {Number.isFinite(movie.vote_average) && movie.vote_average > 0 && (
                                            <Chip
                                                icon={<StarIcon
                                                    sx={{fontSize: '14px !important', color: '#FFD54F !important'}}/>}
                                                label={movie.vote_average.toFixed(1)}
                                                size="small"
                                                sx={{
                                                    backgroundColor: alpha('#FFD54F', 0.15),
                                                    color: '#FFD54F',
                                                    fontWeight: 700
                                                }}
                                            />
                                        )}
                                        {releaseYear && (
                                            <Chip
                                                label={releaseYear}
                                                size="small"
                                                sx={{backgroundColor: alpha(primary, 0.15), color: primary}}
                                            />
                                        )}
                                        {/* 先得到布尔值，避免 runtime 为 0 时被 React 当作文字直接渲染。 */}
                                        {(movie.runtime ?? 0) > 0 && (
                                            <Chip
                                                label={`${movie.runtime} 分钟`}
                                                size="small"
                                                sx={{backgroundColor: alpha(primary, 0.15), color: primary}}
                                            />
                                        )}
                                        {movie.genres.slice(0, 3).map((g) => (
                                            <Chip
                                                key={g.id}
                                                label={g.name}
                                                size="small"
                                                variant="outlined"
                                                sx={{borderColor: alpha(primary, 0.4), color: 'text.secondary'}}
                                            />
                                        ))}
                                    </Box>
                                    <ProductionInfo key={`production:${movie.id}`}
                                                    spoken_languages={movie.spoken_languages}
                                                    production_countries={movie.production_countries}
                                                    production_companies={movie.production_companies}/>
                                    <ExpandableOverview key={movie.id} text={movie.overview || '暂无简介'}
                                                        collapsedLines={10}/>
                                </Box>
                            </Box>

                            <MediaCredits key={movie.id} mediaId={movie.id} mediaType="movie"/>
                            <MediaImageGallery key={`images:${movie.id}`} mediaId={movie.id} mediaType="movie"
                                               name={movie.title} posterPath={movie.poster_path}
                                               backdropPath={movie.backdrop_path}
                                               posterOpen={posterOpenId === movie.id}
                                               onPosterClose={() => setPosterOpenId(null)}/>

                            {/* 默认显示“想看”不代表已保存；明确选择状态后才进入追踪列表。 */}
                            <Box
                                sx={{
                                    p: 3,
                                    borderRadius: 2,
                                    backgroundColor: alpha(primary, 0.06),
                                    border: `1px solid ${alpha(primary, 0.15)}`,
                                    mt: 3,
                                    mb: 2,
                                }}
                            >
                                <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1.5}}>
                                    观看状态
                                </Typography>
                                {record && (
                                    <GlobalStatusPicker
                                        status={record.global_status || 'Wish'}
                                        onStatusChange={(s: WatchStatus) => setMovieStatus(movie.id, s, {
                                            name: movie.title,
                                            poster_path: movie.poster_path
                                        })}
                                    />
                                )}
                            </Box>
                            {movie.belongs_to_collection && movie.belongs_to_collection.id > 0 && (
                                <MediaRecommendations key={`collection:${movie.id}`}
                                                      mediaId={movie.belongs_to_collection.id} mediaType="movie"
                                                      kind="collection" currentMovieId={movie.id}/>
                            )}
                            <MediaRecommendations key={`recommendations:${movie.id}`} mediaId={movie.id}
                                                  mediaType="movie"/>
                            <MediaRecommendations key={`similar:${movie.id}`} mediaId={movie.id} mediaType="movie"
                                                  kind="similar"/>
                        </>
                    ) : null}
                </Container>
            </Box>
        </React.Fragment>
    );
};

export default MovieDetailPage;
