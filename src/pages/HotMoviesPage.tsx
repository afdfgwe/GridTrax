import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
    Alert,
    Box,
    Button,
    Container,
    IconButton,
    LinearProgress,
    Skeleton,
    Tabs,
    Tab,
    Tooltip,
    Typography
} from '@mui/material';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import {useHotMovies} from '../hooks/useHotMovies';
import type {HotRow, HotKind} from '../types/hotMovies';

const clamp = {display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden'} as const;

function MovieRow({row, kind}: { row: HotRow; kind: HotKind }) {
    const {item, movie, status} = row;
    const destination = movie ? `/${kind}/${movie.id}` : `/search?q=${encodeURIComponent(item.title)}`;
    return (
        <Box component="li" sx={{
            display: 'grid', gridTemplateColumns: {xs: '22px 80px minmax(0, 1fr)', sm: '26px 104px minmax(0, 1fr)'},
            gap: {xs: 1, sm: 1.5}, py: 2.5, borderBottom: 1, borderColor: 'divider', alignItems: 'start'
        }}>
            <Typography aria-label={`第 ${item.rank} 名`} sx={{
                fontWeight: 800, fontSize: 20, textAlign: 'center',
                fontVariantNumeric: 'tabular-nums', color: item.rank <= 3 ? 'primary.main' : 'text.secondary'
            }}>{item.rank}</Typography>
            <Box component={Link} to={destination} aria-label={movie ? `查看${item.title}详情` : `搜索${item.title}`}
                 sx={{
                     display: 'block',
                     aspectRatio: '2 / 3',
                     borderRadius: 1,
                     overflow: 'hidden',
                     bgcolor: 'action.hover'
                 }}>
                {status === 'loading' ? <Skeleton variant="rectangular" width="100%" height="100%"/> :
                    <Box component="img" src={getPosterUrl(movie?.poster_path ?? undefined)} alt={item.title}
                         loading="lazy"
                         onError={event => {
                             event.currentTarget.onerror = null;
                             event.currentTarget.src = '/placeholder-poster.svg';
                         }}
                         sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>}
            </Box>
            <Box sx={{minWidth: 0}}>
                <Typography component={Link} to={destination} title={item.title}
                            sx={{
                                ...clamp,
                                WebkitLineClamp: 2,
                                fontSize: 16,
                                lineHeight: 1.5,
                                fontWeight: 700,
                                color: 'text.primary',
                                textDecoration: 'none',
                                overflowWrap: 'anywhere',
                                '&:hover': {color: 'primary.main'}
                            }}>
                    {item.title}
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5}}>
                    {item.year && <Typography variant="caption" color="text.secondary">{item.year}</Typography>}
                    {typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0 &&
                        <Typography variant="body2" sx={{fontWeight: 700, color: 'warning.main'}}>
                            豆瓣 {item.rating.toFixed(1)}
                        </Typography>}
                    {typeof movie?.vote_average === 'number' && Number.isFinite(movie.vote_average) && movie.vote_average > 0 &&
                        <Typography variant="body2" sx={{fontWeight: 700, color: 'primary.main'}}>
                            TMDB {movie.vote_average.toFixed(1)}
                        </Typography>}
                </Box>
                {status === 'loading' ?
                    <Box sx={{mt: 1}} aria-label="正在匹配 TMDB"><Skeleton/><Skeleton/><Skeleton width="70%"/></Box> :
                    <Typography variant="body2" color="text.secondary"
                                sx={{...clamp, WebkitLineClamp: 3, mt: 1, lineHeight: 1.7, overflowWrap: 'anywhere'}}>
                        {status === 'error' ? 'TMDB 资料加载失败' : status === 'unmatched' ? '暂未匹配到 TMDB 影片' : movie?.overview || '暂无简介'}
                    </Typography>}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5}}>
                    <Tooltip title="在豆瓣查看"><IconButton size="small" component="a"
                                                       href={`https://m.douban.com/movie/subject/${item.id}/`}
                                                       target="_blank" rel="noopener noreferrer"
                                                       aria-label={`在豆瓣查看${item.title}`}>
                        <OpenInNewIcon sx={{fontSize: 16}}/>
                    </IconButton></Tooltip>
                    {(status === 'unmatched' || status === 'error') &&
                        <Tooltip title="搜索影片"><IconButton size="small" component={Link}
                                                          to={destination} aria-label={`搜索${item.title}`}><SearchIcon
                            sx={{fontSize: 18}}/></IconButton></Tooltip>}
                </Box>
            </Box>
        </Box>
    );
}

/** 榜单同时展示豆瓣与 TMDB 评分，详情和观看记录仍使用 TMDB，二者不互相覆盖。 */
export default function HotMoviesPage() {
    const [kind, setKind] = useState<HotKind>('movie');
    const {rows, fetchedAt, error, loading, matching, refresh} = useHotMovies(kind);
    const matchError = rows.find(row => row.error)?.error;
    const fetchedDate = fetchedAt ? new Date(fetchedAt) : undefined;
    return (
        <Container maxWidth="lg" sx={{py: {xs: 2, sm: 4}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Tooltip title="返回追踪"><IconButton component={Link} to="/" aria-label="返回追踪" size="small"><ArrowBackIcon
                    fontSize="small"/></IconButton></Tooltip>
                <Typography component="h1" variant="h6" sx={{fontWeight: 700, flex: 1}}>实时热门榜</Typography>
                <Tooltip title="刷新榜单"><span><IconButton aria-label="刷新榜单" onClick={refresh}
                                                        disabled={loading || matching} size="small">
                    <RefreshIcon fontSize="small"/>
                </IconButton></span></Tooltip>
            </Box>
            <Tabs value={kind} onChange={(_, value: HotKind) => setKind(value)} aria-label="热门榜类型" sx={{mt: 1}}>
                <Tab value="movie" label="电影"/>
                <Tab value="tv" label="电视剧"/>
            </Tabs>
            <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mt: 1.5, mb: 2}}>
                <Typography variant="caption" color="text.secondary">豆瓣 · TOP 10</Typography>
                {fetchedDate && Number.isFinite(fetchedDate.getTime()) &&
                    <Typography variant="caption" color="text.secondary">
                        获取于 {fetchedDate.toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                    </Typography>}
            </Box>
            <Box sx={{height: 2}}>{(loading || matching) &&
                <LinearProgress sx={{height: 2}} aria-label="加载电影热门榜"/>}</Box>
            {error && <Alert severity="warning" sx={{mt: 2}} action={<Button color="inherit" size="small"
                                                                             onClick={refresh}>重试</Button>}>{error}</Alert>}
            {matchError && <Alert severity="warning" sx={{mt: 2}}
                                  action={<Button color="inherit" size="small" disabled={matching}
                                                  onClick={refresh}>重试</Button>}>
                豆瓣榜单已加载，部分 TMDB 资料未能获取。{matchError}
            </Alert>}
            {loading && <Box aria-label="正在获取豆瓣榜单"
                             sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', md: '1fr 1fr'}, gap: 3, py: 3}}>
                {Array.from({length: 6}, (_, index) => <Skeleton key={index} variant="rectangular" height={160}
                                                                 sx={{borderRadius: 1}}/>)}
            </Box>}
            <Box component="ol" aria-label={`豆瓣${kind === 'movie' ? '电影' : '电视剧'}实时热门榜`} sx={{
                listStyle: 'none', p: 0, m: 0, display: 'grid',
                gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}, columnGap: {md: 4, lg: 6}
            }}>
                {rows.map(row => <MovieRow key={row.item.id} row={row} kind={kind}/>)}
            </Box>
        </Container>
    );
}
