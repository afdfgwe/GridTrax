import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
    Alert, Box, Button, Chip, Container, IconButton, Link, Skeleton, Tooltip, Typography,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useCallback, useState} from 'react';
import {Link as RouterLink, useNavigate, useParams} from 'react-router-dom';
import {getBackdropUrl, getGenres, getMovieCollection, getPosterUrl} from '../api/tmdb';
import ExpandableOverview from '../components/ExpandableOverview';
import {useAsyncResource} from '../hooks/useAsyncResource';
import type {TMDBGenre, TMDBMovieRecommendation} from '../types';
import {getCollectionMovies} from '../utils/movieCollection';

/** 图片路径缺失或加载失败时统一使用海报占位，保持列表尺寸稳定。 */
function CollectionPoster({path, title}: { path?: string | null; title: string }) {
    const [failedPath, setFailedPath] = useState<string>();
    const poster = path && path !== failedPath ? path : undefined;
    return <Box component="img" src={getPosterUrl(poster)} alt={title} loading="lazy" decoding="async"
                onError={() => {
                    if (poster) setFailedPath(poster);
                }}
                sx={{
                    display: 'block', width: '100%', aspectRatio: '2 / 3', objectFit: 'cover',
                    borderRadius: 1, bgcolor: 'action.hover'
                }}/>;
}

/** 成员电影只使用合集 parts 中的资料，不为列表逐部请求详情或演职员。 */
function CollectionMovie({movie, genres}: { movie: TMDBMovieRecommendation; genres: readonly TMDBGenre[] }) {
    const title = movie.title?.trim() || movie.original_title?.trim() || '未知电影';
    const originalTitle = movie.original_title?.trim();
    const releaseDate = movie.release_date?.trim();
    const score = movie.vote_average;
    const scoreLabel = typeof score === 'number' && Number.isFinite(score) && score > 0 ? score.toFixed(1) : undefined;
    const genreNames = [...new Set(movie.genre_ids ?? [])]
        .map(id => genres.find(genre => genre.id === id)?.name?.trim())
        .filter((name): name is string => Boolean(name));
    return <Box component="li" sx={{
        display: 'grid', alignItems: 'start',
        gridTemplateColumns: {xs: '88px minmax(0, 1fr)', sm: '120px minmax(0, 1fr)'},
        columnGap: {xs: 2, sm: 3}, rowGap: 1.5, py: {xs: 2.5, sm: 3}, borderBottom: 1, borderColor: 'divider',
        '&:last-child': {borderBottom: 0}
    }}>
        <Link component={RouterLink} to={`/movie/${movie.id}`} aria-label={`查看${title}详情`}
              sx={{display: 'block', borderRadius: 1}}>
            <CollectionPoster path={movie.poster_path} title={title}/>
        </Link>
        <Box sx={{minWidth: 0}}>
            <Link component={RouterLink} to={`/movie/${movie.id}`} color="text.primary" underline="hover"
                  sx={{
                      display: 'inline-block', fontSize: '1.125rem', fontWeight: 700,
                      lineHeight: 1.4, overflowWrap: 'anywhere'
                  }}>{title}</Link>
            {originalTitle && originalTitle !== title && <Typography variant="body2" color="text.secondary"
                                                                     sx={{
                                                                         mt: 0.5,
                                                                         overflowWrap: 'anywhere'
                                                                     }}>{originalTitle}</Typography>}
            {(releaseDate || scoreLabel) && <Box sx={{
                display: 'flex', flexWrap: 'wrap',
                alignItems: 'center', gap: 1.5, my: 1
            }}>
                {releaseDate && <Typography component="time" dateTime={releaseDate} variant="caption"
                                            color="text.secondary">{releaseDate}</Typography>}
                {scoreLabel && <Typography variant="caption" sx={{
                    fontWeight: 700,
                    color: theme => theme.palette.mode === 'dark' ? '#FFD166' : '#936000'
                }}>
                    TMDB {scoreLabel}
                </Typography>}
            </Box>}
            {genreNames.length > 0 && <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1}}>
                {genreNames.map(name => <Chip key={name} label={name} size="small" variant="outlined"
                    sx={{height: 22, borderRadius: 1, color: 'text.secondary', '& .MuiChip-label': {px: 1}}}/>)}
            </Box>}
        </Box>
        {movie.overview?.trim() && <Box sx={{gridColumn: '1 / -1', minWidth: 0}}>
            <ExpandableOverview text={movie.overview.trim()} collapsedLines={4}/>
        </Box>}
    </Box>;
}

const loadMovieGenres = () => getGenres('movie');

/** 整个列表共用电影类型字典及其缓存，字典加载失败不阻塞合集正文。 */
function CollectionMovieList({movies}: { movies: TMDBMovieRecommendation[] }) {
    const {data: genres, error, retry} = useAsyncResource('movie-genres', loadMovieGenres);
    return <>
        {error && <Alert severity="warning" sx={{mt: 2}} action={
            <Button color="inherit" size="small" onClick={retry}>重试</Button>
        }>电影类型暂时加载失败，其余影片信息不受影响。</Alert>}
        <Box component="ul" sx={{listStyle: 'none', p: 0, m: 0}}>
            {movies.map(movie => <CollectionMovie key={movie.id} movie={movie} genres={genres ?? []}/>)}
        </Box>
    </>;
}

/** 合集详情与电影页共享五分钟接口缓存，纯展示，不创建或改变本地观看记录。 */
export default function CollectionDetailPage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const collectionId = Number(id);
    const validId = Number.isSafeInteger(collectionId) && collectionId > 0;
    const load = useCallback(() => getMovieCollection(collectionId), [collectionId]);
    const {data: collection, loading, error, retry} = useAsyncResource(`collection:${id}`, load);
    const movies = collection ? getCollectionMovies(collection.parts) : [];
    const title = collection?.name?.trim() || collection?.original_name?.trim() || '未知合集';
    const originalName = collection?.original_name?.trim();
    const goBack = () => window.history.state?.idx > 0 ? navigate(-1) : navigate('/search');

    return <Box sx={{position: 'relative', minHeight: '80vh'}}>
        <Box sx={{
            position: 'relative', height: {xs: 220, sm: 300, md: 340},
            overflow: 'hidden', bgcolor: 'background.paper'
        }}>
            {collection?.backdrop_path && <Box component="img" src={getBackdropUrl(collection.backdrop_path)} alt=""
                 sx={{width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55)'}}/>}
            <Box aria-hidden="true" sx={{
                position: 'absolute', inset: 0, background: theme =>
                    `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0.12)}, ${alpha(theme.palette.background.default, 0.55)} 65%, ${theme.palette.background.default})`
            }}/>
            <Tooltip title="返回"><IconButton onClick={goBack} aria-label="返回上一页" sx={{
                position: 'absolute', top: 16, left: 16, zIndex: 1,
                bgcolor: alpha('#000', 0.5), color: '#fff',
                '&:hover': {bgcolor: alpha('#000', 0.7)}
            }}>
                    <ArrowBackIcon fontSize="small"/>
            </IconButton></Tooltip>
        </Box>
        <Container maxWidth="lg" sx={{
            position: 'relative', pb: 5,
            // 海报从背景图中部开始，标题与简介自然接在海报下方。
            mt: collection || loading ? {xs: -20, sm: -27.5, md: -31.25} : 0
        }}>
            {error && <Alert severity="error" action={validId &&
                <Button color="inherit" size="small" onClick={retry}>重试</Button>}>
                {validId ? error : '合集编号无效，请从搜索结果重新进入。'}
            </Alert>}
            {loading && <Box aria-label="正在加载合集详情" sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5
            }}>
                <Skeleton variant="rounded" sx={{width: {xs: 160, sm: 190, md: 210}, aspectRatio: '2/3', height: 'auto'}}/>
                <Box sx={{width: '100%', maxWidth: 800}}><Skeleton width="60%" height={48} sx={{mx: 'auto'}}/>
                    <Skeleton width="35%" height={28} sx={{mx: 'auto'}}/>
                    <Skeleton/><Skeleton/><Skeleton width="70%"/></Box>
                <Box sx={{width: '100%'}}><Skeleton width={140} height={40}/>
                    <Skeleton height={120}/><Skeleton height={120}/></Box>
            </Box>}
            {collection && <>
                <Box component="section" aria-labelledby="collection-name" sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 2.5, pb: {xs: 3, sm: 4}
                }}>
                    <Box sx={{
                        width: {xs: 160, sm: 190, md: 210}, maxWidth: '55vw', flexShrink: 0,
                        borderRadius: 2, '& img': {borderRadius: 'inherit'},
                        boxShadow: theme => `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`
                    }}>
                        <CollectionPoster key={collection.id} path={collection.poster_path} title={title}/>
                    </Box>
                    <Box sx={{minWidth: 0, width: '100%', textAlign: 'center'}}>
                        <Chip label="电影合集" size="small" variant="outlined" sx={{mb: 1.5}}/>
                        <Typography id="collection-name" component="h1" sx={{
                            fontSize: '2rem',
                            fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere'
                        }}>{title}</Typography>
                        {originalName && originalName !== title && <Typography color="text.secondary"
                                                                               variant="body2" sx={{
                            mt: 1,
                            overflowWrap: 'anywhere'
                        }}>{originalName}</Typography>}
                    </Box>
                    {collection.overview?.trim() && <Box sx={{width: '100%', maxWidth: 800, minWidth: 0}}>
                        <ExpandableOverview key={collection.id} text={collection.overview.trim()} collapsedLines={10}/>
                    </Box>}
                </Box>
                <Box component="section" aria-labelledby="collection-movies" sx={{
                    borderTop: 1,
                    borderColor: 'divider', pt: 2.5
                }}>
                    <Box sx={{display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 1.5}}>
                        <Typography id="collection-movies" component="h2" variant="h6"
                                    fontWeight={700}>系列电影</Typography>
                        <Typography variant="body2" color="text.secondary">{movies.length} 部</Typography>
                    </Box>
                    {movies.length ? <CollectionMovieList key={collection.id} movies={movies}/> :
                        <Typography color="text.secondary" variant="body2" sx={{py: 3}}>暂无系列电影</Typography>}
                </Box>
            </>}
        </Container>
    </Box>;
}
