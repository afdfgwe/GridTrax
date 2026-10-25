import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import {
    Alert, Box, Button, Chip, Container, Drawer, IconButton, LinearProgress, Skeleton, Tooltip,
    Typography, useMediaQuery,
} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useCallback, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {discoverMovies, getCountries, getGenres, getLanguages, getPosterUrl} from '../api/tmdb';
import MovieDiscoveryFilters from '../components/MovieDiscoveryFilters';
import PosterScoreBadge from '../components/PosterScoreBadge';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {
    DEFAULT_DISCOVERY_FILTERS, DISCOVERY_SORTS, discoveryLanguageLabel, parseMovieDiscovery,
    resolveDiscoveryPage, serializeMovieDiscovery, type MovieDiscoveryFilters as Filters,
} from '../utils/movieDiscovery';

const loadGenres = () => getGenres('movie');

/** 高级找片独立于榜单；已应用条件与页码写入网址，沿用全站历史滚动恢复。 */
export default function MovieDiscoveryPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.toString();
    const filters = useMemo(() => parseMovieDiscovery(new URLSearchParams(query)), [query]);
    const filterKey = serializeMovieDiscovery(filters).toString();
    const page = resolveDiscoveryPage(searchParams.get('page'));
    const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const genres = useAsyncResource('discovery-genres', loadGenres);
    const countries = useAsyncResource('discovery-countries', getCountries);
    const languages = useAsyncResource('discovery-languages', getLanguages);
    const [pagination, setPagination] = useState<{ key: string; total: number; count: number }>();
    const load = useCallback(async (signal: AbortSignal) => {
        const result = await discoverMovies(filters, page);
        if (!signal.aborted) setPagination({key: filterKey, total: result.total_pages, count: result.total_results});
        return result;
    }, [filters, filterKey, page]);
    const {data, error, loading, retry} = useAsyncResource(`${filterKey}:${page}`, load);
    // 翻页期间只保留同一组条件的总页数，避免页码短暂变成另一套条件的结果。
    const previous = pagination?.key === filterKey ? pagination : undefined;
    const totalPages = data?.total_pages ?? previous?.total;
    const totalResults = data?.total_results ?? previous?.count;
    const apply = (next: Filters) => {
        setSearchParams(serializeMovieDiscovery(next));
        setDrawerOpen(false);
    };
    const changePage = (next: number) => setSearchParams(serializeMovieDiscovery(filters, next));
    const remove = (...keys: Array<keyof Filters>) => {
        const next = {...filters};
        for (const key of keys) Object.assign(next, {[key]: DEFAULT_DISCOVERY_FILTERS[key]});
        apply(next);
    };

    const tags: Array<{ key: string; label: string; remove: () => void }> = filters.genres.map(id => ({
        key: `genre-${id}`, label: genres.data?.find(genre => genre.id === id)?.name ?? `类型 ${id}`,
        remove: () => apply({...filters, genres: filters.genres.filter(value => value !== id)}),
    }));
    if (filters.country) tags.push({
        key: 'country',
        label: countries.data?.find(country => country.iso_3166_1 === filters.country)?.native_name || filters.country,
        remove: () => remove('country')
    });
    if (filters.language) tags.push({
        key: 'language',
        label: discoveryLanguageLabel(filters.language),
        remove: () => remove('language')
    });
    if (filters.yearFrom || filters.yearTo) tags.push({
        key: 'year',
        label: `${filters.yearFrom || '不限'}–${filters.yearTo || '不限'} 年`,
        remove: () => remove('yearFrom', 'yearTo')
    });
    if (filters.ratingFrom || filters.ratingTo) tags.push({
        key: 'rating',
        label: `评分 ${filters.ratingFrom || '0'}–${filters.ratingTo || '10'}`,
        remove: () => remove('ratingFrom', 'ratingTo')
    });
    if (filters.minVotes) tags.push({
        key: 'votes',
        label: `至少 ${filters.minVotes} 人评分`,
        remove: () => remove('minVotes')
    });
    if (filters.runtimeFrom || filters.runtimeTo) tags.push({
        key: 'runtime',
        label: `${filters.runtimeFrom || '0'}–${filters.runtimeTo || '不限'} 分钟`,
        remove: () => remove('runtimeFrom', 'runtimeTo')
    });

    const form = <MovieDiscoveryFilters key={filterKey} initial={filters} genres={genres.data ?? []}
                                        countries={countries.data ?? []} languages={languages.data ?? []}
                                        onApply={apply}/>;
    const pager = <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
        <Tooltip title="上一页"><span><IconButton size="small" aria-label="找片上一页" disabled={loading || page <= 1}
                                               onClick={() => changePage(page - 1)}><ChevronLeftIcon fontSize="small"/></IconButton></span></Tooltip>
        <Typography variant="caption" aria-label="找片页码"
                    sx={{minWidth: '7ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums'}}>
            {page} / {totalPages === undefined ? '…' : Math.max(1, totalPages)}
        </Typography>
        <Tooltip title="下一页"><span><IconButton size="small" aria-label="找片下一页"
                                               disabled={loading || Boolean(error) || totalPages === undefined || page >= totalPages}
                                               onClick={() => changePage(page + 1)}><ChevronRightIcon fontSize="small"/></IconButton></span></Tooltip>
    </Box>;

    return <Container maxWidth="lg" sx={{py: {xs: 2, sm: 3}, px: {xs: 2, sm: 3}}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 3}}>
            <Tooltip title="返回追踪"><IconButton component={Link} to="/" aria-label="返回追踪" size="small"><ArrowBackIcon
                fontSize="small"/></IconButton></Tooltip>
            <Typography component="h1" sx={{fontSize: {xs: 22, sm: 30}, fontWeight: 800, flex: 1}}>筛选找片</Typography>
            <Chip label="电影" size="small" variant="outlined"/>
        </Box>
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: '260px minmax(0, 1fr)'},
            gap: {xs: 2, md: 4},
            alignItems: 'start'
        }}>
            {desktop && <Box component="aside" aria-label="电影筛选条件" sx={{
                position: 'sticky', top: 96,
                maxHeight: 'calc(100dvh - 112px)', overflowY: 'auto', pr: 1.5, scrollbarWidth: 'thin'
            }}>
                <Typography component="h2" variant="subtitle1" fontWeight={700} sx={{mb: 2.5}}>筛选条件</Typography>
                {form}
            </Box>}
            <Box sx={{minWidth: 0}}>
                <Box sx={{
                    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 1, pb: 1.5, mb: 2, borderBottom: 1, borderColor: 'divider'
                }}>
                    {!desktop ? <Button size="small" color="inherit" variant="outlined" startIcon={<TuneIcon/>}
                                        onClick={() => setDrawerOpen(true)} aria-label="打开电影筛选条件" sx={{flexShrink: 0}}>
                        筛选{tags.length ? ` (${tags.length})` : ''}
                    </Button> : <Typography variant="body2" color="text.secondary">
                        {totalResults === undefined ? '电影' : `${totalResults.toLocaleString('zh-CN')} 部电影`}
                    </Typography>}
                    {pager}
                    {loading && <LinearProgress aria-label="正在筛选电影"
                                                sx={{position: 'absolute', bottom: -1, left: 0, right: 0, height: 2}}/>}
                </Box>
                <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2}}>
                    <Typography variant="caption" color="text.secondary" sx={{mr: 'auto'}}>
                        {DISCOVERY_SORTS.find(option => option.value === filters.sort)?.label}
                    </Typography>
                    {!desktop && totalResults !== undefined && <Typography variant="caption"
                                                                           color="text.secondary">{totalResults.toLocaleString('zh-CN')} 部电影</Typography>}
                </Box>
                {tags.length > 0 &&
                    <Box aria-label="已应用的筛选条件" sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2}}>
                        {tags.map(tag => <Chip key={tag.key} label={tag.label} size="small" onDelete={tag.remove}/>)}
                        <Button size="small" color="inherit"
                                onClick={() => apply({...DEFAULT_DISCOVERY_FILTERS, genres: []})}>清空筛选</Button>
                    </Box>}
                {[genres, countries, languages].some(resource => resource.error) &&
                    <Alert severity="warning" sx={{mb: 2}}
                           action={<Button size="small" color="inherit" onClick={() => {
                               if (genres.error) genres.retry();
                               if (countries.error) countries.retry();
                               if (languages.error) languages.retry();
                           }}>重试</Button>}>部分筛选选项暂时无法加载，电影结果不受影响。</Alert>}
                {error && <Alert severity="error" sx={{mb: 2}} action={<Button size="small" color="inherit"
                                                                               onClick={retry}>重试</Button>}>{error}</Alert>}
                {!loading && !error && !data?.results.length && <Box sx={{py: 8, textAlign: 'center'}}>
                    <Typography color="text.secondary" sx={{mb: 2}}>没有找到符合条件的电影</Typography>
                    {page > 1 ? <Button onClick={() => changePage(1)}>返回第一页</Button>
                        : <Button onClick={() => apply({...DEFAULT_DISCOVERY_FILTERS, genres: []})}>清空筛选</Button>}
                </Box>}
                {loading && <Box aria-label="正在加载找片结果" sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: 'repeat(3, minmax(0, 1fr))',
                        sm: 'repeat(4, minmax(0, 1fr))',
                        md: 'repeat(5, minmax(0, 1fr))'
                    },
                    gap: {xs: 1.25, sm: 2}
                }}>
                    {Array.from({length: 20}, (_, index) => <Box key={index}><Skeleton variant="rounded" sx={{
                        aspectRatio: '2 / 3',
                        height: 'auto',
                        borderRadius: '8px'
                    }}/>
                        <Skeleton sx={{mt: 0.5}}/><Skeleton width="45%"/></Box>)}
                </Box>}
                {!loading && data && <Box component="ol" aria-label="找片结果" sx={{
                    display: 'grid', listStyle: 'none', m: 0, p: 0,
                    gridTemplateColumns: {
                        xs: 'repeat(3, minmax(0, 1fr))',
                        sm: 'repeat(4, minmax(0, 1fr))',
                        md: 'repeat(5, minmax(0, 1fr))'
                    },
                    columnGap: {xs: 1.25, sm: 2}, rowGap: 2.5
                }}>
                    {data.results.map(movie => <Box component="li" key={movie.id} sx={{minWidth: 0}}>
                        <Box component={Link} to={`/movie/${movie.id}`} sx={{
                            display: 'block',
                            textDecoration: 'none',
                            color: 'text.primary',
                            borderRadius: '8px',
                            '&:hover img': {opacity: 0.85},
                            '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 4}
                        }}>
                            <Box sx={{
                                position: 'relative',
                                aspectRatio: '2 / 3',
                                overflow: 'hidden',
                                borderRadius: '8px',
                                bgcolor: 'action.hover'
                            }}>
                                <Box component="img" src={getPosterUrl(movie.poster_path ?? undefined)}
                                     alt={movie.title} loading="lazy"
                                     onError={event => {
                                         if (!event.currentTarget.src.endsWith('/placeholder-poster.svg')) event.currentTarget.src = '/placeholder-poster.svg';
                                     }} sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                    transition: 'opacity 150ms'
                                }}/>
                                <PosterScoreBadge score={movie.vote_average}/>
                            </Box>
                            <Typography variant="body2" fontWeight={700} noWrap title={movie.title}
                                        sx={{mt: 0.75, fontSize: {xs: 12, sm: 14}}}>{movie.title}</Typography>
                            <Typography variant="caption" color="text.secondary"
                                        sx={{display: 'block', minHeight: '1.5em', fontSize: {xs: 11, sm: 12}}}>
                                {movie.release_date?.slice(0, 4)}
                            </Typography>
                        </Box>
                    </Box>)}
                </Box>}
                {!loading && !error && Boolean(data?.results.length) && <Box sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    mt: 3,
                    pt: 1.5,
                    borderTop: 1,
                    borderColor: 'divider'
                }}>{pager}</Box>}
            </Box>
        </Box>
        {!desktop && drawerOpen && <Drawer anchor="right" open onClose={() => setDrawerOpen(false)}
                                           sx={{zIndex: theme => theme.zIndex.drawer + 2}}
                                           slotProps={{
                                               paper: {
                                                   role: 'dialog',
                                                   'aria-modal': true,
                                                   'aria-labelledby': 'discovery-drawer-title',
                                                   sx: {width: 'min(100%, 380px)', bgcolor: 'background.default'}
                                               }
                                           }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2.5,
                py: 2,
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <Typography id="discovery-drawer-title" component="h2" variant="h6">筛选条件</Typography>
                <Tooltip title="关闭筛选"><IconButton aria-label="关闭筛选"
                                                  onClick={() => setDrawerOpen(false)}><CloseIcon/></IconButton></Tooltip>
            </Box>
            <Box sx={{overflowY: 'auto', px: 2.5, pt: 2.5, pb: 'max(8px, env(safe-area-inset-bottom))'}}>{form}</Box>
        </Drawer>}
    </Container>;
}
