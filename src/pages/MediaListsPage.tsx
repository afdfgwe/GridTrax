import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Alert,
    Box,
    Button,
    Container,
    IconButton,
    LinearProgress,
    MenuItem,
    Select,
    Skeleton,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from '@mui/material';
import {Link, useSearchParams} from 'react-router-dom';
import RankingRow from '../components/RankingRow';
import {useHotMovies} from '../hooks/useHotMovies';
import type {HotKind, MovieListKind, TVListKind} from '../types/hotMovies';
import {resolveTVListKind, resolveTVListPage, TV_LIST_LABELS} from '../utils/tvLists';
import {MOVIE_LIST_LABELS, resolveMovieListKind} from '../utils/movieLists';

const tvLists: TVListKind[] = ['airing_today', 'on_the_air', 'popular', 'top_rated'];
const movieLists: MovieListKind[] = ['now_playing', 'popular', 'top_rated', 'upcoming'];

/** 与实时热门榜独立的影视列表，列表及页码保存在网址中，详情返回时可恢复。 */
export default function MediaListsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    // 兼容原有电视剧列表网址；类别、列表和页码共同保留在网址中。
    const kind: HotKind = searchParams.get('kind') === 'movie' ? 'movie' : 'tv';
    const kindLabel = kind === 'movie' ? '电影' : '电视剧';
    const tvList = resolveTVListKind(searchParams.get('list'));
    const movieList = resolveMovieListKind(searchParams.get('list'));
    const activeList = kind === 'movie' ? movieList : tvList;
    const listLabel = kind === 'movie' ? MOVIE_LIST_LABELS[movieList] : TV_LIST_LABELS[tvList];
    const lists = kind === 'movie' ? movieLists : tvLists;
    const page = resolveTVListPage(searchParams.get('page'));
    const {
        rows, genres, genreError, countries, countryError, fetchedAt, error, loading, refresh, totalPages,
    } = useHotMovies(kind, 'tmdb', 'day', kind === 'movie' ? {movieList, page} : {tvList, page});
    const fetchedDate = fetchedAt ? new Date(fetchedAt) : undefined;

    const changeKind = (nextKind: HotKind) => {
        setSearchParams({kind: nextKind}, {replace: true});
    };
    const changeList = (list: MovieListKind | TVListKind) => {
        setSearchParams({kind, list}, {replace: true});
    };
    const changePage = (nextPage: number) => {
        setSearchParams({kind, list: activeList, page: String(nextPage)});
        window.scrollTo({top: 0, behavior: 'instant'});
    };

    return (
        <Container maxWidth="md" sx={{py: {xs: 2, sm: 4}, px: {xs: 2, sm: 3}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Tooltip title="返回追踪"><IconButton component={Link} to="/" aria-label="返回追踪" size="small">
                    <ArrowBackIcon fontSize="small"/>
                </IconButton></Tooltip>
                <Typography component="h1"
                            sx={{fontSize: {xs: 22, sm: 30}, fontWeight: 800, flex: 1, lineHeight: 1.25}}>
                    影视列表
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700}}>TMDB</Typography>
                <Tooltip title="刷新列表"><span><IconButton aria-label="刷新列表" onClick={refresh}
                                                        disabled={loading} size="small">
                    <RefreshIcon fontSize="small"/>
                </IconButton></span></Tooltip>
            </Box>
            <Box sx={{position: 'relative', borderBottom: 1, borderColor: 'divider', mt: {xs: 2, sm: 3}}}>
                <Tabs value={kind} onChange={(_, value: HotKind) => changeKind(value)} aria-label="影视列表类型"
                      sx={{
                          minHeight: 44,
                          '& .MuiTabs-indicator': {height: 2, visibility: loading ? 'hidden' : 'visible'},
                          '& .MuiTab-root': {minHeight: 44, minWidth: 72, px: 2, fontSize: 15, fontWeight: 700}
                      }}>
                    <Tab value="movie" label="电影"/>
                    <Tab value="tv" label="电视剧"/>
                </Tabs>
                {loading && <LinearProgress aria-label="加载影视列表" sx={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 0,
                }}/>}
            </Box>
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap',
            }}>
                <Select size="small" value={activeList} inputProps={{'aria-label': `${kindLabel}列表`}}
                        onChange={event => changeList(event.target.value as MovieListKind | TVListKind)}
                        sx={{minWidth: 112, fontSize: 13, '& .MuiSelect-select': {py: 0.75}}}>
                    {lists.map(list => <MenuItem key={list} value={list}>
                        {kind === 'movie' ? MOVIE_LIST_LABELS[list as MovieListKind] : TV_LIST_LABELS[list as TVListKind]}
                    </MenuItem>)}
                </Select>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto'}}>
                    <Tooltip title="上一页"><span><IconButton size="small" aria-label={`${kindLabel}列表上一页`}
                                                           disabled={loading || page <= 1}
                                                           onClick={() => changePage(page - 1)}>
                        <ChevronLeftIcon fontSize="small"/>
                    </IconButton></span></Tooltip>
                    <Typography variant="caption" aria-label={`${kindLabel}列表页码`} sx={{
                        minWidth: '6ch', textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                    }}>{page} / {totalPages === undefined ? '…' : Math.max(1, totalPages)}</Typography>
                    <Tooltip title="下一页"><span><IconButton size="small" aria-label={`${kindLabel}列表下一页`}
                                                           disabled={loading || Boolean(error) || totalPages === undefined || page >= totalPages}
                                                           onClick={() => changePage(page + 1)}>
                        <ChevronRightIcon fontSize="small"/>
                    </IconButton></span></Tooltip>
                </Box>
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'flex-end', minHeight: 36, alignItems: 'center'}}>
                {fetchedDate && Number.isFinite(fetchedDate.getTime()) &&
                    <Typography variant="caption" color="text.secondary" sx={{fontVariantNumeric: 'tabular-nums'}}>
                        更新于 {fetchedDate.toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                    </Typography>}
            </Box>
            {error && <Alert severity="warning" sx={{mb: 2}}
                             action={<Button color="inherit" size="small"
                                             onClick={refresh}>重试</Button>}>{error}</Alert>}
            {genreError && <Alert severity="warning" sx={{mb: 2}}
                                  action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>
                {kindLabel}列表已加载，类型名称暂时无法获取。{genreError}
            </Alert>}
            {countryError && <Alert severity="warning" sx={{mb: 2}}
                                    action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>
                地区名称暂时无法获取，暂显示地区代码。{countryError}
            </Alert>}
            {!loading && !error && rows.length === 0 && <Typography color="text.secondary" sx={{py: 2}}>
                暂无{kindLabel}
            </Typography>}
            {loading && <Box aria-label={`正在获取${kindLabel}列表`}>
                {Array.from({length: 5}, (_, index) => <Box key={index} sx={{
                    display: 'flex', gap: 2, py: 3, borderBottom: 1, borderColor: 'divider', '&:first-of-type': {pt: 2},
                }}>
                    <Skeleton variant="rectangular" sx={{
                        width: 96, aspectRatio: '2 / 3', height: 'auto', flexShrink: 0, borderRadius: 1.5,
                    }}/>
                    <Box sx={{flex: 1, minWidth: 0}}><Skeleton width="55%" height={32}/>
                        <Skeleton width="30%"/><Skeleton/><Skeleton width="85%"/></Box>
                </Box>)}
            </Box>}
            {rows.length > 0 && <Box component="ol" aria-label={`TMDB${kindLabel}${listLabel}列表`}
                                     sx={{listStyle: 'none', p: 0, m: 0}}>
                {rows.map(row => <RankingRow key={`${kind}-${activeList}-${page}-${row.item.id}`} row={row}
                                             kind={kind} source="tmdb" genres={genres} countries={countries}/>)}
            </Box>}
        </Container>
    );
}
