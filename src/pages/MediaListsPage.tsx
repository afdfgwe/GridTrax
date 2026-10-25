import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Alert, Box, Button, Container, IconButton, LinearProgress, MenuItem, Select, Skeleton, Tooltip, Typography,
} from '@mui/material';
import {Link, useSearchParams} from 'react-router-dom';
import RankingRow from '../components/RankingRow';
import {useHotMovies} from '../hooks/useHotMovies';
import type {TVListKind} from '../types/hotMovies';
import {resolveTVListKind, resolveTVListPage, TV_LIST_LABELS} from '../utils/tvLists';

const lists: TVListKind[] = ['airing_today', 'on_the_air', 'popular', 'top_rated'];

/** 与实时热门榜独立的影视列表，列表及页码保存在网址中，详情返回时可恢复。 */
export default function MediaListsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tvList = resolveTVListKind(searchParams.get('list'));
    const page = resolveTVListPage(searchParams.get('page'));
    const {
        rows, genres, genreError, countries, countryError, fetchedAt, error, loading, refresh, totalPages,
    } = useHotMovies('tv', 'tmdb', 'day', {tvList, page});
    const fetchedDate = fetchedAt ? new Date(fetchedAt) : undefined;

    const changeList = (list: TVListKind) => {
        setSearchParams({list}, {replace: true});
    };
    const changePage = (nextPage: number) => {
        setSearchParams({list: tvList, page: String(nextPage)});
        window.scrollTo({top: 0, behavior: 'instant'});
    };

    return (
        <Container maxWidth="md" sx={{py: {xs: 2, sm: 4}, px: {xs: 2, sm: 3}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Tooltip title="返回追踪"><IconButton component={Link} to="/" aria-label="返回追踪" size="small">
                    <ArrowBackIcon fontSize="small"/>
                </IconButton></Tooltip>
                <Typography component="h1" sx={{fontSize: {xs: 22, sm: 30}, fontWeight: 800, flex: 1, lineHeight: 1.25}}>
                    影视列表
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700}}>TMDB</Typography>
                <Tooltip title="刷新列表"><span><IconButton aria-label="刷新列表" onClick={refresh}
                                                       disabled={loading} size="small">
                    <RefreshIcon fontSize="small"/>
                </IconButton></span></Tooltip>
            </Box>
            <Box sx={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 1, mt: {xs: 2, sm: 3},
                pb: 1.25, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap',
            }}>
                <Typography sx={{fontSize: 15, fontWeight: 700}}>电视剧</Typography>
                <Select size="small" value={tvList} inputProps={{'aria-label': '电视剧列表'}}
                        onChange={event => changeList(event.target.value as TVListKind)}
                        sx={{minWidth: 112, fontSize: 13, '& .MuiSelect-select': {py: 0.75}}}>
                    {lists.map(list => <MenuItem key={list} value={list}>{TV_LIST_LABELS[list]}</MenuItem>)}
                </Select>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto'}}>
                    <Tooltip title="上一页"><span><IconButton size="small" aria-label="电视剧列表上一页"
                        disabled={loading || page <= 1} onClick={() => changePage(page - 1)}>
                        <ChevronLeftIcon fontSize="small"/>
                    </IconButton></span></Tooltip>
                    <Typography variant="caption" aria-label="电视剧列表页码" sx={{
                        minWidth: '6ch', textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                    }}>{page} / {totalPages === undefined ? '…' : Math.max(1, totalPages)}</Typography>
                    <Tooltip title="下一页"><span><IconButton size="small" aria-label="电视剧列表下一页"
                        disabled={loading || Boolean(error) || totalPages === undefined || page >= totalPages}
                        onClick={() => changePage(page + 1)}>
                        <ChevronRightIcon fontSize="small"/>
                    </IconButton></span></Tooltip>
                </Box>
                {loading && <LinearProgress aria-label="加载影视列表" sx={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 0,
                }}/>}
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
                             action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>{error}</Alert>}
            {genreError && <Alert severity="warning" sx={{mb: 2}}
                                  action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>
                电视剧列表已加载，类型名称暂时无法获取。{genreError}
            </Alert>}
            {countryError && <Alert severity="warning" sx={{mb: 2}}
                                    action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>
                地区名称暂时无法获取，暂显示地区代码。{countryError}
            </Alert>}
            {!loading && !error && rows.length === 0 && <Typography color="text.secondary" sx={{py: 2}}>
                暂无电视剧
            </Typography>}
            {loading && <Box aria-label="正在获取电视剧列表">
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
            {rows.length > 0 && <Box component="ol" aria-label={`TMDB电视剧${TV_LIST_LABELS[tvList]}列表`}
                                    sx={{listStyle: 'none', p: 0, m: 0}}>
                {rows.map(row => <RankingRow key={`${tvList}-${page}-${row.item.id}`} row={row}
                                            kind="tv" source="tmdb" genres={genres} countries={countries}/>)}
            </Box>}
        </Container>
    );
}
