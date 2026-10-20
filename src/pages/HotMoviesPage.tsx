import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {Alert, Box, Button, Container, IconButton, LinearProgress, Skeleton, Tab, Tabs, Tooltip, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import {useHotMovies} from '../hooks/useHotMovies';
import type {HotKind, HotRow} from '../types/hotMovies';

const clamp = {display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden'} as const;

function Scores({row}: {row: HotRow}) {
    const {item, movie} = row;
    const douban = typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0;
    const tmdb = typeof movie?.vote_average === 'number' && Number.isFinite(movie.vote_average) && movie.vote_average > 0;
    if (!douban && !tmdb) return null;
    return (
        <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: {xs: 1.5, sm: 2}, rowGap: 0.25}}>
            {douban && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">豆瓣</Typography>
                <Typography component="span" sx={{fontSize: 18, lineHeight: 1.3, fontWeight: 800, color: 'warning.main', fontVariantNumeric: 'tabular-nums'}}>
                    {item.rating!.toFixed(1)}
                </Typography>
            </Box>}
            {tmdb && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">TMDB</Typography>
                <Typography component="span" sx={{fontSize: 18, lineHeight: 1.3, fontWeight: 800, color: 'primary.main', fontVariantNumeric: 'tabular-nums'}}>
                    {movie!.vote_average!.toFixed(1)}
                </Typography>
            </Box>}
        </Box>
    );
}

function Poster({row, destination, featured}: {row: HotRow; destination: string; featured: boolean}) {
    const {item, movie, status} = row;
    return (
        <Box component={Link} to={destination} aria-label={movie ? `查看${item.title}详情` : `搜索${item.title}`}
             sx={{display: 'block', position: 'relative', aspectRatio: '2 / 3', overflow: 'hidden', borderRadius: 1,
                 bgcolor: 'action.hover', boxShadow: featured ? 5 : 1,
                 '&:hover img': {transform: 'scale(1.045)'}}}>
            {status === 'loading' ? <Skeleton variant="rectangular" width="100%" height="100%"/> :
                <Box component="img" src={getPosterUrl(movie?.poster_path ?? undefined)} alt={item.title}
                     loading={featured ? 'eager' : 'lazy'}
                     onError={event => {
                         event.currentTarget.onerror = null;
                         event.currentTarget.src = '/placeholder-poster.svg';
                     }}
                     sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                         transition: 'transform 250ms ease', '@media (prefers-reduced-motion: reduce)': {transition: 'none'}}}/>}
            {featured && <Box aria-hidden="true" sx={{position: 'absolute', top: 0, left: 0, px: 1.25, py: 0.5,
                bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 18, fontWeight: 900,
                fontVariantNumeric: 'tabular-nums', borderBottomRightRadius: 6}}>01</Box>}
        </Box>
    );
}

function RowContent({row, kind, featured}: {row: HotRow; kind: HotKind; featured: boolean}) {
    const {item, movie, status} = row;
    const destination = movie ? `/${kind}/${movie.id}` : `/search?q=${encodeURIComponent(item.title)}`;
    return (
        <Box sx={{minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: '100%'}}>
            {featured && <Typography variant="overline" sx={{lineHeight: 1.5, fontWeight: 800, color: 'primary.main'}}>
                本期榜首 / NO. 01
            </Typography>}
            <Typography component={Link} to={destination} title={item.title}
                        sx={{...clamp, WebkitLineClamp: 2, fontSize: featured ? {xs: 21, sm: 27} : {xs: 16, sm: 17},
                            lineHeight: 1.35, fontWeight: 800, color: 'text.primary', textDecoration: 'none',
                            overflowWrap: 'anywhere', mt: featured ? 0.75 : 0,
                            '&:hover': {color: 'primary.main'}}}>
                {item.title}
            </Typography>
            {item.year && <Typography variant="caption" color="text.secondary" sx={{mt: 0.5, fontVariantNumeric: 'tabular-nums'}}>
                {item.year} · {kind === 'movie' ? '电影' : '电视剧'}
            </Typography>}
            <Box sx={{mt: featured ? 1.5 : 1}}><Scores row={row}/></Box>
            {status === 'loading' ?
                <Box sx={{mt: 1.5, width: '100%'}} aria-label="正在匹配 TMDB"><Skeleton/><Skeleton width="72%"/></Box> :
                <Typography variant="body2" color="text.secondary"
                            sx={{...clamp, WebkitLineClamp: featured ? 3 : 2, mt: featured ? 1.5 : 1,
                                lineHeight: 1.7, overflowWrap: 'anywhere'}}>
                    {status === 'error' ? 'TMDB 资料加载失败' : status === 'unmatched' ? '暂未匹配到 TMDB 影片' : movie?.overview || '暂无简介'}
                </Typography>}
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', pt: featured ? 1.5 : 0.75}}>
                {featured && <Button component={Link} to={destination} size="small" endIcon={movie ? <ArrowForwardIcon/> : <SearchIcon/>}
                                     sx={{px: 0.5, mr: 1}}>{movie ? '查看详情' : '搜索影片'}</Button>}
                <Tooltip title="在豆瓣查看"><IconButton size="small" component="a"
                                                   href={`https://m.douban.com/movie/subject/${item.id}/`}
                                                   target="_blank" rel="noopener noreferrer"
                                                   aria-label={`在豆瓣查看${item.title}`} sx={{color: 'text.secondary'}}>
                    <OpenInNewIcon sx={{fontSize: 17}}/>
                </IconButton></Tooltip>
                {!featured && (status === 'unmatched' || status === 'error') &&
                    <Tooltip title="搜索影片"><IconButton size="small" component={Link} to={destination}
                                                      aria-label={`搜索${item.title}`}><SearchIcon sx={{fontSize: 18}}/></IconButton></Tooltip>}
            </Box>
        </Box>
    );
}

function MovieRow({row, kind, featured = false}: {row: HotRow; kind: HotKind; featured?: boolean}) {
    const {item, movie} = row;
    const destination = movie ? `/${kind}/${movie.id}` : `/search?q=${encodeURIComponent(item.title)}`;
    if (featured) return (
        <Box component="li" sx={{display: 'grid', gridColumn: '1 / -1',
            gridTemplateColumns: {xs: '108px minmax(0, 1fr)', sm: '154px minmax(0, 1fr)'},
            gap: {xs: 2, sm: 3.5}, p: {xs: 2, sm: 3}, borderRadius: 1, bgcolor: 'background.paper',
            border: 1, borderColor: (theme) => alpha(theme.palette.primary.main, 0.28),
            boxShadow: (theme) => `0 12px 38px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.16 : 0.07)}`}}>
            <Poster row={row} destination={destination} featured/>
            <RowContent row={row} kind={kind} featured/>
        </Box>
    );
    return (
        <Box component="li" sx={{display: 'grid',
            gridTemplateColumns: {xs: '30px 78px minmax(0, 1fr)', sm: '36px 94px minmax(0, 1fr)'},
            gap: {xs: 1.25, sm: 1.75}, py: {xs: 2, sm: 2.5}, px: {xs: 0.5, sm: 1},
            borderBottom: 1, borderColor: 'divider', minWidth: 0, alignItems: 'start',
            transition: 'background-color 180ms ease',
            '&:hover': {bgcolor: (theme) => alpha(theme.palette.primary.main, 0.045)},
            '@media (prefers-reduced-motion: reduce)': {transition: 'none'}}}>
            <Typography aria-label={`第 ${item.rank} 名`} sx={{fontWeight: 900, fontSize: {xs: 18, sm: 21}, lineHeight: 1.3,
                fontVariantNumeric: 'tabular-nums', color: item.rank <= 3 ? 'primary.main' : 'text.secondary'}}>
                {String(item.rank).padStart(2, '0')}
            </Typography>
            <Poster row={row} destination={destination} featured={false}/>
            <RowContent row={row} kind={kind} featured={false}/>
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
            <Box sx={{display: 'flex', alignItems: 'center', gap: {xs: 1, sm: 1.5}}}>
                <Tooltip title="返回追踪"><IconButton component={Link} to="/" aria-label="返回追踪" size="small"><ArrowBackIcon fontSize="small"/></IconButton></Tooltip>
                <Typography component="h1" sx={{fontSize: {xs: 24, sm: 30}, fontWeight: 800, flex: 1, lineHeight: 1.25}}>实时热门榜</Typography>
                <Tooltip title="刷新榜单"><span><IconButton aria-label="刷新榜单" onClick={refresh}
                                                        disabled={loading || matching} size="small"><RefreshIcon fontSize="small"/></IconButton></span></Tooltip>
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 1,
                borderBottom: 1, borderColor: 'divider', mt: {xs: 2, sm: 3}}}>
                <Tabs value={kind} onChange={(_, value: HotKind) => setKind(value)} aria-label="热门榜类型"
                      sx={{minHeight: 44, '& .MuiTab-root': {minHeight: 44, minWidth: 72, px: {xs: 1.5, sm: 2.5},
                          fontWeight: 700, fontSize: 15}}}>
                    <Tab value="movie" label="电影"/>
                    <Tab value="tv" label="电视剧"/>
                </Tabs>
                <Typography variant="caption" color="text.secondary" sx={{pb: 1.25, whiteSpace: 'nowrap', fontWeight: 700}}>
                    豆瓣 TOP 10
                </Typography>
            </Box>
            <Box sx={{height: 3}}>{(loading || matching) &&
                <LinearProgress sx={{height: 3}} aria-label="加载热门榜"/>}</Box>
            <Box sx={{display: 'flex', justifyContent: 'flex-end', minHeight: 32, alignItems: 'center'}}>
                {fetchedDate && Number.isFinite(fetchedDate.getTime()) &&
                    <Typography variant="caption" color="text.secondary" sx={{fontVariantNumeric: 'tabular-nums'}}>
                        更新于 {fetchedDate.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}
                    </Typography>}
            </Box>
            {error && <Alert severity="warning" sx={{mb: 2}} action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>{error}</Alert>}
            {matchError && <Alert severity="warning" sx={{mb: 2}}
                                  action={<Button color="inherit" size="small" disabled={matching} onClick={refresh}>重试</Button>}>
                豆瓣榜单已加载，部分 TMDB 资料未能获取。{matchError}
            </Alert>}
            {loading && <Box aria-label="正在获取豆瓣榜单" sx={{display: 'grid',
                gridTemplateColumns: {xs: '1fr', md: '1fr 1fr'}, gap: 2, py: 2}}>
                <Skeleton variant="rectangular" height={220} sx={{gridColumn: {md: '1 / -1'}, borderRadius: 1}}/>
                {Array.from({length: 4}, (_, index) => <Skeleton key={index} variant="rectangular" height={156} sx={{borderRadius: 1}}/>)}
            </Box>}
            {rows.length > 0 && <Box component="ol" aria-label={`豆瓣${kind === 'movie' ? '电影' : '电视剧'}实时热门榜`}
                                     sx={{listStyle: 'none', p: 0, m: 0, display: 'grid',
                                         gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'},
                                         columnGap: {md: 3, lg: 5}}}>
                {rows.map((row, index) => <MovieRow key={row.item.id} row={row} kind={kind} featured={index === 0}/>)}
            </Box>}
        </Container>
    );
}
