import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Alert,
    Box,
    Button,
    Container,
    IconButton,
    LinearProgress,
    Skeleton,
    Tab,
    Tabs,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography
} from '@mui/material';
import {Link, useSearchParams} from 'react-router-dom';
import RankingRow from '../components/RankingRow';
import {useHotMovies} from '../hooks/useHotMovies';
import type {HotCategory, HotSource, TrendingWindow} from '../types/hotMovies';
import {resolveHotCategory} from '../utils/trendingMovies';

const categoryLabels: Record<HotCategory, string> = {movie: '电影', tv: '电视剧', person: '人物'};


/** 热门榜只展示豆瓣实时榜与 TMDB 日榜、周榜；影视列表使用独立页面。 */
export default function HotMoviesPage() {
    // 榜单选项随当前网址保留，详情返回或刷新时恢复；列表切换不额外增加历史。
    const [searchParams, setSearchParams] = useSearchParams();
    const source: HotSource = searchParams.get('source') === 'tmdb' ? 'tmdb' : 'douban';
    const kind = resolveHotCategory(searchParams.get('kind'), source);
    const timeWindow: TrendingWindow = searchParams.get('window') === 'week' ? 'week' : 'day';
    const changeSelection = (key: 'source' | 'kind' | 'window', value: HotSource | HotCategory | TrendingWindow) => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.set(key, value);
            next.delete('page');
            next.delete('list');
            // 从人物榜切回豆瓣时同时修正网址，避免保留一个豆瓣不支持的类别。
            if (key === 'source' && value === 'douban' && next.get('kind') === 'person') next.set('kind', 'movie');
            return next;
        }, {replace: true});
    };
    const activeKind = kind;
    const {
        rows,
        genres,
        genreError,
        countries,
        countryError,
        fetchedAt,
        error,
        loading,
        matching,
        refresh
    } = useHotMovies(activeKind, source, timeWindow);
    const sourceLabel = source === 'tmdb' ? 'TMDB' : '豆瓣';
    const matchError = rows.find(row => row.error)?.error;
    const fetchedDate = fetchedAt ? new Date(fetchedAt) : undefined;
    return (
        <Container maxWidth="md" sx={{py: {xs: 2, sm: 4}, px: {xs: 2, sm: 3}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Tooltip title="返回追踪"><IconButton component={Link} to="/" aria-label="返回追踪" size="small"><ArrowBackIcon
                    fontSize="small"/></IconButton></Tooltip>
                <Typography component="h1" sx={{
                    fontSize: {xs: 22, sm: 30},
                    fontWeight: 800,
                    flex: 1,
                    lineHeight: 1.25
                }}>实时热门榜</Typography>
                <ToggleButtonGroup value={source} exclusive size="small" aria-label="热门榜来源"
                                   onChange={(_, value: HotSource | null) => {
                                       if (value) changeSelection('source', value);
                                   }}
                                   sx={{
                                       flexShrink: 0,
                                       '& .MuiToggleButton-root': {px: 0.75, py: 0.5, fontSize: 12, lineHeight: 1.5}
                                   }}>
                    <ToggleButton value="douban" aria-label="豆瓣榜单">豆瓣</ToggleButton>
                    <ToggleButton value="tmdb" aria-label="TMDB 榜单">TMDB</ToggleButton>
                </ToggleButtonGroup>
                <Tooltip title="刷新榜单"><span><IconButton aria-label="刷新榜单" onClick={refresh}
                                                        disabled={loading || matching} size="small"><RefreshIcon
                    fontSize="small"/></IconButton></span></Tooltip>
            </Box>
            <Box sx={{
                position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 1,
                borderBottom: 1, borderColor: 'divider', mt: {xs: 2, sm: 3}
            }}>
                <Tabs value={activeKind} onChange={(_, value: HotCategory) => changeSelection('kind', value)}
                      aria-label="热门榜类型"
                      sx={{
                          minHeight: 44,
                          minWidth: 0,
                          '& .MuiTabs-indicator': {height: 2, visibility: loading || matching ? 'hidden' : 'visible'},
                          '& .MuiTab-root': {
                              minHeight: 44, minWidth: {xs: 64, sm: 72}, px: {xs: 1.5, sm: 2.5},
                              fontWeight: 700, fontSize: 15
                          }
                      }}>
                    <Tab value="movie" label="电影"/>
                    <Tab value="tv" label="电视剧"/>
                    {source === 'tmdb' && <Tab value="person" label="人物"/>}
                </Tabs>
                {source === 'tmdb' ? <ToggleButtonGroup value={timeWindow} exclusive size="small" aria-label="TMDB 榜单周期"
                                                        onChange={(_, value: TrendingWindow | null) => {
                                                            if (value) changeSelection('window', value);
                                                        }}
                                                        sx={{
                                                            mb: 0.75,
                                                            flexShrink: 0,
                                                            '& .MuiToggleButton-root': {
                                                                px: 1,
                                                                py: 0.5,
                                                                fontSize: 12,
                                                                lineHeight: 1.5
                                                            }
                                                        }}>
                    <ToggleButton value="day" aria-label={`TMDB ${categoryLabels[kind]}日榜`}>日榜</ToggleButton>
                    <ToggleButton value="week"
                                  aria-label={`TMDB ${categoryLabels[kind]}周榜`}>周榜</ToggleButton>
                </ToggleButtonGroup> : source === 'douban' && <Typography variant="caption" color="text.secondary"
                                                   sx={{pb: 1.25, whiteSpace: 'nowrap', fontWeight: 700}}>豆瓣 TOP
                    10</Typography>}
                {(loading || matching) && <LinearProgress aria-label="加载热门榜"
                                                          sx={{
                                                              position: 'absolute',
                                                              left: 0,
                                                              right: 0,
                                                              bottom: 0,
                                                              height: 2,
                                                              borderRadius: 0
                                                          }}/>}
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'flex-end', minHeight: 36, alignItems: 'center'}}>
                {fetchedDate && Number.isFinite(fetchedDate.getTime()) &&
                    <Typography variant="caption" color="text.secondary" sx={{fontVariantNumeric: 'tabular-nums'}}>
                        更新于 {fetchedDate.toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                    </Typography>}
            </Box>
            {error && <Alert severity="warning" sx={{mb: 2}} action={<Button color="inherit" size="small"
                                                                             onClick={refresh}>重试</Button>}>{error}</Alert>}
            {genreError && <Alert severity="warning" sx={{mb: 2}}
                                  action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>
                {kind === 'movie' ? '电影' : '电视剧'}榜单已加载，类型名称暂时无法获取。{genreError}
            </Alert>}
            {countryError && <Alert severity="warning" sx={{mb: 2}}
                                    action={<Button color="inherit" size="small" onClick={refresh}>重试</Button>}>
                地区名称暂时无法获取，暂显示地区代码。{countryError}
            </Alert>}
            {matchError && <Alert severity="warning" sx={{mb: 2}}
                                  action={<Button color="inherit" size="small" disabled={matching}
                                                  onClick={refresh}>重试</Button>}>
                豆瓣榜单已加载，部分 TMDB 资料未能获取。{matchError}
            </Alert>}
            {!loading && !error && rows.length === 0 &&
                <Typography color="text.secondary" sx={{py: 2}}>{kind === 'person' ? '暂无热门人物' : '暂无热门影片'}</Typography>}
            {loading && <Box aria-label={`正在获取${sourceLabel}榜单`} sx={kind === 'person' ? {
                display: 'grid', gridTemplateColumns: {xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))'},
                columnGap: 3, alignItems: 'start'
            } : undefined}>
                {Array.from({length: kind === 'person' ? 6 : 5}, (_, index) => <Box key={index} sx={{
                    display: 'flex', gap: kind === 'person' ? 1.5 : 2, py: kind === 'person' ? 1.75 : 3,
                    minWidth: 0, borderBottom: 1, borderColor: 'divider',
                    ...(kind !== 'person' && {'&:first-of-type': {pt: 2}})
                }}>
                    <Skeleton variant="rectangular" sx={{
                        width: kind === 'person' ? {xs: 64, sm: 72} : 96, aspectRatio: '2 / 3',
                        height: 'auto', flexShrink: 0, borderRadius: 1.5
                    }}/>
                    <Box sx={{flex: 1, minWidth: 0}}><Skeleton width="55%" height={kind === 'person' ? 24 : 32}/>
                        <Skeleton width="30%"/><Skeleton/>{kind !== 'person' && <Skeleton width="85%"/>}</Box>
                </Box>)}
            </Box>}
            {rows.length > 0 &&
                <Box component="ol" aria-label={`${sourceLabel}${categoryLabels[activeKind]}实时热门榜`}
                     sx={{
                         listStyle: 'none', p: 0, m: 0,
                         // 人物资料较少，宽屏双列、窄屏单列，不再沿用影视榜的大海报间距。
                         ...(activeKind === 'person' && {
                             display: 'grid', gridTemplateColumns: {xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))'},
                             columnGap: 3, alignItems: 'start'
                         })
                     }}>
                    {rows.map(row => <RankingRow
                        key={`${source}-${activeKind}-${source === 'tmdb' ? timeWindow : ''}-${row.item.id}`} row={row}
                        kind={activeKind} source={source} genres={genres} countries={countries}/>)}
                </Box>}
        </Container>
    );
}
