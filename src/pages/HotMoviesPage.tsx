import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Alert, Box, Button, Container, IconButton, LinearProgress, Skeleton, Tab, Tabs, Tooltip, Typography} from '@mui/material';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import ExpandableOverview from '../components/ExpandableOverview';
import {useHotMovies} from '../hooks/useHotMovies';
import type {HotKind, HotRow} from '../types/hotMovies';
import {parseHotMovieInfo} from '../utils/hotMovieInfo';

function HotInfo({info}: {info?: string}) {
    const parts = parseHotMovieInfo(info);
    if (!parts.length) return null;
    return (
        <Box component="dl" sx={{display: 'grid', rowGap: 0.375, m: 0, mt: 1}}>
            {parts.map(({label, value}) => <Box component="div" key={label}
                                               sx={{display: 'grid', gridTemplateColumns: '2.5em minmax(0, 1fr)', columnGap: 1,
                                                   alignItems: 'baseline', minWidth: 0}}>
                <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                <Typography component="dd" variant="body2" sx={{m: 0, minWidth: 0, overflowWrap: 'anywhere'}}>
                    {value}
                </Typography>
            </Box>)}
        </Box>
    );
}

function Scores({row}: {row: HotRow}) {
    const {item, movie} = row;
    const douban = typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0;
    const tmdb = typeof movie?.vote_average === 'number' && Number.isFinite(movie.vote_average) && movie.vote_average > 0;
    if (!douban && !tmdb) return null;
    return (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: {xs: 1.5, sm: 2.5}, alignItems: 'baseline', mt: 1.25}}>
            {douban && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">豆瓣</Typography>
                <Typography component="span" sx={{fontSize: 20, lineHeight: 1.2, fontWeight: 800,
                    color: 'warning.main', fontVariantNumeric: 'tabular-nums'}}>{item.rating!.toFixed(1)}</Typography>
            </Box>}
            {tmdb && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">TMDB</Typography>
                <Typography component="span" sx={{fontSize: 20, lineHeight: 1.2, fontWeight: 800,
                    color: 'primary.main', fontVariantNumeric: 'tabular-nums'}}>{movie!.vote_average!.toFixed(1)}</Typography>
            </Box>}
        </Box>
    );
}

function MovieRow({row, kind}: {row: HotRow; kind: HotKind}) {
    const {item, movie, status} = row;
    const destination = movie ? `/${kind}/${movie.id}` : `/search?q=${encodeURIComponent(item.title)}`;
    const overview = status === 'error' ? 'TMDB 资料加载失败' :
        status === 'unmatched' ? '暂未匹配到 TMDB 影片' : movie?.overview || '暂无简介';
    return (
        <Box component="li" sx={{minWidth: 0, borderBottom: 1, borderColor: 'divider', display: 'grid',
            gridTemplateColumns: {xs: '96px minmax(0, 1fr)', sm: '140px minmax(0, 1fr)'},
            columnGap: {xs: 2, sm: 3}, rowGap: 1.5, py: {xs: 2.5, sm: 3}, px: {xs: 0, sm: 1}}}>
            <Box component={Link} to={destination} aria-label={movie ? `查看${item.title}详情` : `搜索${item.title}`}
                 sx={{position: 'relative', width: '100%', aspectRatio: '2 / 3', alignSelf: 'start',
                     gridRow: {sm: '1 / span 2'}, overflow: 'hidden', borderRadius: 1.5, bgcolor: 'action.hover',
                     '&:hover img': {transform: 'scale(1.035)'},
                     '@media (prefers-reduced-motion: reduce)': {'& img': {transition: 'none'}}}}>
                    {status === 'loading' ? <Skeleton variant="rectangular" width="100%" height="100%"/> :
                        <Box component="img" src={getPosterUrl(movie?.poster_path ?? undefined)} alt=""
                             loading={item.rank <= 3 ? 'eager' : 'lazy'}
                             onError={event => {
                                 event.currentTarget.onerror = null;
                                 event.currentTarget.src = '/placeholder-poster.svg';
                             }}
                             sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                                 transition: 'transform 250ms ease'}}/>}
                    <Box aria-hidden="true" sx={{position: 'absolute', left: 0, top: 0, px: 1, py: 0.25,
                        bgcolor: item.rank <= 3 ? 'primary.main' : 'rgba(12, 18, 22, 0.88)',
                        color: item.rank <= 3 ? 'primary.contrastText' : '#fff',
                        fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums'}}>
                        {String(item.rank).padStart(2, '0')}
                    </Box>
            </Box>
            <Box sx={{minWidth: 0}}>
                    <Typography component="h2" sx={{fontWeight: 750, fontSize: {xs: 18, sm: 23}, lineHeight: 1.35,
                        overflowWrap: 'anywhere'}}>
                        <Box component={Link} to={destination} sx={{color: 'text.primary', textDecoration: 'none',
                            '&:hover, &:focus-visible': {color: 'primary.main', textDecoration: 'underline'}}}>
                            {item.title}
                        </Box>
                        {item.year && <Typography component="span" color="text.secondary"
                                                  sx={{display: 'inline-block', ml: 0.75, fontSize: {xs: 14, sm: 16},
                                                      fontWeight: 400, whiteSpace: 'nowrap'}}>({item.year})</Typography>}
                    </Typography>
                    <HotInfo info={item.info}/>
                    <Scores row={row}/>
                    {status === 'loading' && <Box sx={{mt: 2}} aria-label="正在匹配 TMDB"><Skeleton/><Skeleton width="75%"/></Box>}
            </Box>
            {status !== 'loading' && <Box sx={{gridColumn: {xs: '1 / -1', sm: '2'}}}>
                <ExpandableOverview text={overview} collapsedLines={4} expandLabel="展开全部"/>
            </Box>}
        </Box>
    );
}

/** 豆瓣决定排名，TMDB 提供海报、简介与详情；未匹配的作品仍可通过站内搜索打开。 */
export default function HotMoviesPage() {
    const [kind, setKind] = useState<HotKind>('movie');
    const {rows, fetchedAt, error, loading, matching, refresh} = useHotMovies(kind);
    const matchError = rows.find(row => row.error)?.error;
    const fetchedDate = fetchedAt ? new Date(fetchedAt) : undefined;
    return (
        <Container maxWidth="md" sx={{py: {xs: 2, sm: 4}, px: {xs: 2, sm: 3}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
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
            <Box sx={{display: 'flex', justifyContent: 'flex-end', minHeight: 36, alignItems: 'center'}}>
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
            {loading && <Box aria-label="正在获取豆瓣榜单">
                {Array.from({length: 5}, (_, index) => <Box key={index} sx={{display: 'flex', gap: 2, py: 3, borderBottom: 1, borderColor: 'divider'}}>
                    <Skeleton variant="rectangular" width={96} height={144}/>
                    <Box sx={{flex: 1}}><Skeleton width="55%" height={32}/><Skeleton width="30%"/><Skeleton/><Skeleton width="85%"/></Box>
                </Box>)}
            </Box>}
            {rows.length > 0 && <Box component="ol" aria-label={`豆瓣${kind === 'movie' ? '电影' : '电视剧'}实时热门榜`}
                                     sx={{listStyle: 'none', p: 0, m: 0}}>
                {rows.map(row => <MovieRow key={row.item.id} row={row} kind={kind}/>)}
            </Box>}
        </Container>
    );
}
