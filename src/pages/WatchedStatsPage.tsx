import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Alert, Box, Button, CardActionArea, Container, IconButton, LinearProgress,
    Pagination, Tab, Tabs, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useCallback, useMemo} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {getCountries, getPosterUrl} from '../api/tmdb';
import PosterScoreBadge from '../components/common/PosterScoreBadge';
import WatchedDistributionChart from '../components/stats/WatchedDistributionChart';
import WatchedGenreRadar from '../components/stats/WatchedGenreRadar';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {useWatchedGenres} from '../hooks/useWatchedGenres';
import {useProgressStore} from '../store/useProgressStore';
import {getMediaMetadataKey} from '../utils/media/mediaMetadataCache';
import {getMediaScore} from '../utils/media/mediaScores';
import {getMediaYearKey} from '../utils/media/mediaYears';
import {getWatchedRecordKey, getWatchedRecords, type WatchedKind} from '../utils/stats/watchedGenres';
import {buildWatchedStats, type WatchedDimension} from '../utils/stats/watchedStats';

const dimensions = {
    genre: {label: '类型', title: '类型分布', metric: '类型覆盖', unit: '类'},
    country: {label: '地区', title: '制片地区分布', metric: '地区覆盖', unit: '个'},
    year: {label: '年份', title: '上映 / 首播年份', metric: '年份覆盖', unit: '年'},
} as const;

/** 只读的观看画像：统计以本地“看过”为准，三种维度共用缓存资料与作品列表。 */
export default function WatchedStatsPage() {
    const theme = useTheme();
    const desktop = useMediaQuery(theme.breakpoints.up('md'));
    const pageSize = desktop ? 16 : 12;
    const records = useProgressStore(state => state.data.records);
    const watched = useMemo(() => getWatchedRecords(Object.values(records)), [records]);
    const {metadata, pendingCount, failedCount, retry} = useWatchedGenres(watched);
    const [params, setParams] = useSearchParams();
    const kindParam = params.get('kind');
    const kind: WatchedKind = kindParam === 'movie' || kindParam === 'tv_season' ? kindParam : 'all';
    const dimensionParam = params.get('dimension');
    const dimension: WatchedDimension = dimensionParam === 'country' || dimensionParam === 'year' ? dimensionParam : 'genre';
    const loadCountries = useCallback(() => watched.length && dimension === 'country' ? getCountries() : Promise.resolve([]), [watched.length, dimension]);
    const countryDictionary = useAsyncResource(`stats-countries:${dimension}:${watched.length > 0}`, loadCountries);
    const stats = useMemo(() => buildWatchedStats(watched, metadata, kind, dimension, countryDictionary.data), [watched, metadata, kind, dimension, countryDictionary.data]);
    const config = dimensions[dimension];
    const selection = stats.rows.find(row => row.key === params.get(dimension));
    const items = selection?.records ?? stats.records;
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const requestedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
    const visibleItems = items.slice((page - 1) * pageSize, page * pageSize);
    const filmColor = theme.palette.mode === 'dark' ? '#eda47d' : '#ae4b25';
    const tvColor = theme.palette.mode === 'dark' ? '#6bd6be' : '#087f71';

    const selectGroup = (key?: string) => {
        const next = new URLSearchParams(params);
        next.delete('page');
        if (key) next.set(dimension, key);
        else next.delete(dimension);
        setParams(next, {replace: true});
    };

    return (
        <Container maxWidth="lg" sx={{py: {xs: 2, sm: 4}, px: {xs: 2, sm: 3}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 3}}>
                <Tooltip title="返回追踪"><IconButton component={Link} to="/" size="small" aria-label="返回追踪">
                    <ArrowBackIcon fontSize="small"/>
                </IconButton></Tooltip>
                <Typography component="h1" sx={{fontSize: {xs: 23, sm: 28}, fontWeight: 800, flex: 1}}>观看统计</Typography>
                <BarChartIcon sx={{color: 'text.secondary', fontSize: 24}}/>
            </Box>

            <Box
                sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap'}}>
                <Tabs value={dimension} aria-label="统计维度" onChange={(_, value: WatchedDimension) => {
                    setParams(kind === 'all' ? {dimension: value} : {dimension: value, kind}, {replace: true});
                }} sx={{minHeight: 36, '& .MuiTab-root': {minHeight: 36, minWidth: 56, px: 1.5, fontSize: 13}}}>
                    {Object.entries(dimensions).map(([key, value]) => <Tab key={key} value={key} label={value.label}/>)}
                </Tabs>
                <ToggleButtonGroup value={kind} exclusive size="small" aria-label="统计影视类别"
                                   onChange={(_, value: WatchedKind | null) => {
                                       if (value) setParams(value === 'all' ? {dimension} : {
                                           dimension,
                                           kind: value
                                       }, {replace: true});
                                   }} sx={{height: 34, '& .MuiToggleButton-root': {px: 2, fontSize: 13}}}>
                    <ToggleButton value="all">全部</ToggleButton>
                    <ToggleButton value="movie">电影</ToggleButton>
                    <ToggleButton value="tv_season">电视剧</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Box sx={{
                display: 'grid',
                gridTemplateColumns: {xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))'},
                mt: 3,
                pb: 3,
                gap: {xs: 3, sm: 2},
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                {[
                    {label: '看过记录', value: stats.total, unit: '条'},
                    {label: '电影', value: stats.movies, unit: '部', color: filmColor},
                    {label: '电视剧', value: stats.seasons, unit: '季', detail: `${stats.shows} 部剧`, color: tvColor},
                    {label: config.metric, value: stats.coverageCount, unit: config.unit},
                ].map(metric => <Box key={metric.label}>
                    <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
                    <Box sx={{display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5, flexWrap: 'wrap'}}>
                        <Typography sx={{
                            fontSize: 32,
                            fontWeight: 800,
                            color: metric.color,
                            lineHeight: 1.2,
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                            {metric.value.toLocaleString('zh-CN')}
                        </Typography>
                        <Typography variant="caption"
                                    color="text.secondary">{metric.unit}{metric.detail ? ` · ${metric.detail}` : ''}</Typography>
                    </Box>
                </Box>)}
            </Box>

            <Box sx={{my: 2, minHeight: 24}} aria-live="polite">
                {watched.length > 0 && <Typography variant="caption" color="text.secondary">
                    电影按部、电视剧按季统计。
                    {dimension === 'genre' && '多类型作品分别计数，占比之和可能超过 100%。'}
                    {dimension === 'country' && '按制片地区统计，多国合拍分别计数；环形图占比以地区归属总次数为分母。'}
                    {dimension === 'year' && '电影按上映年份、电视剧按每季首播年份分组，并非标记“看过”的年份。'}
                </Typography>}
                {pendingCount > 0 && <Box sx={{mt: 1}}>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5}}>
                        <Typography variant="caption" color="text.secondary">正在补全影视资料</Typography>
                        <Typography variant="caption"
                                    color="text.secondary">当前分类已识别 {stats.resolved}/{stats.total} 条</Typography>
                    </Box>
                    <LinearProgress aria-label="影视资料加载中" sx={{height: 3}}/>
                </Box>}
            </Box>
            {failedCount > 0 && <Alert severity="warning" sx={{mb: 2}}
                                       action={<Button size="small" color="inherit" startIcon={<RefreshIcon/>}
                                                       onClick={retry}>重试</Button>}>
                {failedCount} 部作品的资料更新失败，已有结果保留；未识别记录暂不计入当前分布。
            </Alert>}
            {dimension === 'country' && countryDictionary.error && <Alert severity="info" sx={{mb: 2}}
                                                                          action={<Button size="small" color="inherit"
                                                                                          startIcon={<RefreshIcon/>}
                                                                                          onClick={countryDictionary.retry}>重试</Button>}>
                地区中文字典暂不可用，已使用本地名称显示，不影响统计数量。
            </Alert>}

            {stats.total === 0 ? (
                <Box sx={{py: 8, textAlign: 'center'}}>
                    <BarChartIcon sx={{fontSize: 44, color: 'text.disabled', mb: 1}}/>
                    <Typography fontWeight={700}>{watched.length ? '这个分类还没有看过记录' : '还没有看过记录'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>标记为“看过”的影视作品会计入统计。</Typography>
                    <Button component={Link} to="/" startIcon={<ArrowBackIcon/>} sx={{mt: 2}}>返回追踪</Button>
                </Box>
            ) : (
                <Box sx={{
                    display: 'grid', gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)'},
                    gap: {xs: 4, md: 4, lg: 6}, alignItems: 'start'
                }}>
                    <Box component="section" aria-labelledby="genre-distribution-title" sx={{minWidth: 0}}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 2,
                            minHeight: 32,
                            flexWrap: 'wrap'
                        }}>
                            <Typography id="genre-distribution-title" component="h2" fontSize={18} fontWeight={750}
                                        sx={{mr: 'auto'}}>{config.title}</Typography>
                            {dimension !== 'country' && [[filmColor, '电影'], [tvColor, '电视剧']].map(([color, label]) =>
                                <Box key={label} sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                    <Box sx={{width: 7, height: 7, bgcolor: color, borderRadius: '50%'}}/>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                </Box>)}
                        </Box>
                        {stats.rows.length === 0 && <Typography variant="body2" color="text.secondary" sx={{py: 4}}>
                            {pendingCount ? '正在整理观看资料…' : '暂时没有可用的统计资料'}
                        </Typography>}
                        {stats.rows.length > 0 && <WatchedDistributionChart
                            dimension={dimension} rows={stats.rows} selected={selection?.key}
                            onSelect={key => selectGroup(selection?.key === key ? undefined : key)}
                            filmColor={filmColor} tvColor={tvColor}
                        />}
                        {dimension === 'genre' && kind !== 'all' &&
                            <WatchedGenreRadar kind={kind} records={watched} metadata={metadata}
                                               pending={pendingCount > 0} filmColor={filmColor} tvColor={tvColor}/>}
                    </Box>

                    <Box component="section" aria-labelledby="genre-films-title" sx={{minWidth: 0}}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2, minHeight: 32}}>
                            <Typography id="genre-films-title" component="h2" fontSize={18} fontWeight={750}
                                        sx={{overflowWrap: 'anywhere'}}>{selection?.name ?? '全部看过'}</Typography>
                            <Typography variant="body2" color="text.secondary">{items.length}</Typography>
                            {selection &&
                                <Tooltip title="查看全部看过"><IconButton size="small" aria-label={`清除${config.label}筛选`}
                                                                    onClick={() => selectGroup()}
                                                                    sx={{ml: 'auto'}}><CloseIcon
                                    fontSize="small"/></IconButton></Tooltip>}
                        </Box>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: {xs: 1, sm: 1.5}
                        }}>
                            {visibleItems.map(record => {
                                const itemMetadata = metadata[getMediaMetadataKey(record)];
                                const title = record.type === 'tv_season' ? record.show_name || record.name : record.name;
                                const seasonLabel = record.type === 'tv_season' ? record.name || `第 ${record.season_number} 季` : '电影';
                                const year = itemMetadata?.years[getMediaYearKey(record)];
                                return (
                                    <CardActionArea key={getWatchedRecordKey(record)} component={Link}
                                                    to={`/${record.type === 'movie' ? 'movie' : 'tv'}/${record.tmdb_id}`}
                                                    sx={{
                                                        display: 'block',
                                                        borderRadius: 1,
                                                        alignSelf: 'start',
                                                        overflow: 'hidden'
                                                    }}>
                                        <Box sx={{position: 'relative', borderRadius: 1, overflow: 'hidden'}}>
                                            <Box component="img"
                                                 src={getPosterUrl(record.poster_path || itemMetadata?.posterPath)}
                                                 alt={title || '暂无海报'} loading="lazy"
                                                 sx={{
                                                     width: '100%',
                                                     aspectRatio: '2 / 3',
                                                     display: 'block',
                                                     objectFit: 'cover',
                                                     borderRadius: 1,
                                                     bgcolor: 'action.hover'
                                                 }}/>
                                            {year && <Typography component="span" variant="caption" sx={{
                                                position: 'absolute', top: 2, left: 2,
                                                px: 0.375, py: 0.2, borderRadius: 0.75,
                                                bgcolor: 'rgba(0, 0, 0, 0.72)', color: '#fff',
                                                fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.25,
                                                whiteSpace: 'nowrap', pointerEvents: 'none',
                                            }}>{year}年</Typography>}
                                            <PosterScoreBadge compact
                                                              score={getMediaScore(record, itemMetadata?.scores ?? {})}/>
                                        </Box>
                                        <Box sx={{pt: 1, pb: 0.5, minWidth: 0}}>
                                            <Typography variant="body2" fontWeight={650} noWrap
                                                        title={title}>{title || '未命名作品'}</Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap component="div"
                                                        title={seasonLabel} sx={{mt: 0.25}}>
                                                {seasonLabel}
                                            </Typography>
                                        </Box>
                                    </CardActionArea>
                                );
                            })}
                        </Box>
                        {pageCount > 1 && <Box sx={{display: 'flex', justifyContent: 'center', mt: 3}}>
                            <Pagination count={pageCount} page={page} size="small" siblingCount={0}
                                        onChange={(_, nextPage) => {
                                            const next = new URLSearchParams(params);
                                            next.set('page', String(nextPage));
                                            // 只替换列表内容，避免全局路由滚动逻辑把页面带回顶部。
                                            setParams(next, {replace: true, state: {preserveScroll: true}});
                                        }}/>
                        </Box>}
                    </Box>
                </Box>
            )}
        </Container>
    );
}
