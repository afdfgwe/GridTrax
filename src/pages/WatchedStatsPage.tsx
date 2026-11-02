import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Alert, Box, Button, ButtonBase, CardActionArea, Container, IconButton, LinearProgress,
    Pagination, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import {useMemo} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import {useWatchedGenres} from '../hooks/useWatchedGenres';
import {useProgressStore} from '../store/useProgressStore';
import {getMediaMetadataKey} from '../utils/mediaMetadataCache';
import {getMediaYearKey} from '../utils/mediaYears';
import {buildWatchedGenreStats, getWatchedRecordKey, getWatchedRecords, type WatchedKind} from '../utils/watchedGenres';

const PAGE_SIZE = 12;
const formatPercent = (share: number) => `${Math.round(share * 100)}%`;

/** 只读的观看画像：统计以本地“看过”为准，详情资料仅补齐影片类型与海报。 */
export default function WatchedStatsPage() {
    const theme = useTheme();
    const records = useProgressStore(state => state.data.records);
    const watched = useMemo(() => getWatchedRecords(Object.values(records)), [records]);
    const {metadata, pendingCount, failedCount, retry} = useWatchedGenres(watched);
    const [params, setParams] = useSearchParams();
    const kindParam = params.get('kind');
    const kind: WatchedKind = kindParam === 'movie' || kindParam === 'tv_season' ? kindParam : 'all';
    const stats = useMemo(() => buildWatchedGenreStats(watched, metadata, kind), [watched, metadata, kind]);
    const genre = stats.rows.find(row => row.key === params.get('genre'));
    const items = genre?.records ?? stats.records;
    const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const requestedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
    const visibleItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const filmColor = theme.palette.mode === 'dark' ? '#eda47d' : '#ae4b25';
    const tvColor = theme.palette.mode === 'dark' ? '#6bd6be' : '#087f71';
    const maxCount = Math.max(1, ...stats.rows.map(row => row.records.length));

    const selectGenre = (key?: string) => {
        const next = new URLSearchParams(params);
        next.delete('page');
        if (key) next.set('genre', key);
        else next.delete('genre');
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

            <ToggleButtonGroup value={kind} exclusive size="small" aria-label="统计影视类别"
                               onChange={(_, value: WatchedKind | null) => {
                                   if (value) setParams(value === 'all' ? {} : {kind: value}, {replace: true});
                               }} sx={{height: 34, '& .MuiToggleButton-root': {px: 2, fontSize: 13}}}>
                <ToggleButton value="all">全部</ToggleButton>
                <ToggleButton value="movie">电影</ToggleButton>
                <ToggleButton value="tv_season">电视剧</ToggleButton>
            </ToggleButtonGroup>

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
                    {label: '类型覆盖', value: stats.genreCount, unit: '类'},
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
                    电影按部、电视剧按季统计；多类型作品分别计数，占比之和可能超过 100%。
                </Typography>}
                {pendingCount > 0 && <Box sx={{mt: 1}}>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5}}>
                        <Typography variant="caption" color="text.secondary">正在补全类型资料</Typography>
                        <Typography variant="caption"
                                    color="text.secondary">当前分类已识别 {stats.resolved}/{stats.total} 条</Typography>
                    </Box>
                    <LinearProgress aria-label="类型资料加载中" sx={{height: 3}}/>
                </Box>}
            </Box>
            {failedCount > 0 && <Alert severity="warning" sx={{mb: 2}}
                                       action={<Button size="small" color="inherit" startIcon={<RefreshIcon/>}
                                                       onClick={retry}>重试</Button>}>
                {failedCount} 部作品的类型资料获取失败，已有结果保留；未识别记录暂不计入类型分布。
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
                                        sx={{mr: 'auto'}}>类型分布</Typography>
                            {[[filmColor, '电影'], [tvColor, '电视剧']].map(([color, label]) =>
                                <Box key={label} sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                    <Box sx={{width: 7, height: 7, bgcolor: color, borderRadius: '50%'}}/>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                </Box>)}
                        </Box>
                        {stats.rows.length === 0 && <Typography variant="body2" color="text.secondary" sx={{py: 4}}>
                            {pendingCount ? '正在整理观看类型…' : '暂时没有可用的类型资料'}
                        </Typography>}
                        <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                            {stats.rows.map((row, index) => (
                                <ButtonBase key={row.key}
                                            onClick={() => selectGenre(genre?.key === row.key ? undefined : row.key)}
                                            aria-pressed={genre?.key === row.key}
                                            aria-label={`${row.name}，${row.records.length} 条，占比 ${formatPercent(row.share)}`}
                                            sx={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                px: 1.25,
                                                py: 1.25,
                                                borderRadius: 1,
                                                bgcolor: genre?.key === row.key ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                                '&:hover, &.Mui-focusVisible': {bgcolor: alpha(theme.palette.primary.main, 0.07)}
                                            }}>
                                    <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75}}>
                                        <Typography variant="caption" color="text.disabled" sx={{
                                            width: 18,
                                            flexShrink: 0,
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>{String(index + 1).padStart(2, '0')}</Typography>
                                        <Typography variant="body2" fontWeight={650}
                                                    sx={{flex: 1, overflowWrap: 'anywhere'}}>{row.name}</Typography>
                                        <Typography variant="body2" fontWeight={700}
                                                    sx={{fontVariantNumeric: 'tabular-nums'}}>{row.records.length}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{
                                            width: '4ch',
                                            textAlign: 'right',
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>{formatPercent(row.share)}</Typography>
                                    </Box>
                                    <Box sx={{
                                        height: 7,
                                        bgcolor: alpha(theme.palette.text.primary, 0.055),
                                        borderRadius: 1,
                                        ml: '26px',
                                        overflow: 'hidden'
                                    }}>
                                        <Box sx={{
                                            display: 'flex',
                                            height: '100%',
                                            width: `${row.records.length / maxCount * 100}%`,
                                            transition: 'width 250ms ease',
                                            '@media (prefers-reduced-motion: reduce)': {transition: 'none'}
                                        }}>
                                            <Box sx={{
                                                width: `${row.movies / row.records.length * 100}%`,
                                                bgcolor: filmColor
                                            }}/>
                                            <Box sx={{
                                                width: `${row.seasons / row.records.length * 100}%`,
                                                bgcolor: tvColor
                                            }}/>
                                        </Box>
                                    </Box>
                                </ButtonBase>
                            ))}
                        </Box>
                    </Box>

                    <Box component="section" aria-labelledby="genre-films-title" sx={{minWidth: 0}}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2, minHeight: 32}}>
                            <Typography id="genre-films-title" component="h2" fontSize={18} fontWeight={750}
                                        sx={{overflowWrap: 'anywhere'}}>{genre?.name ?? '全部看过'}</Typography>
                            <Typography variant="body2" color="text.secondary">{items.length}</Typography>
                            {genre && <Tooltip title="查看全部看过"><IconButton size="small" aria-label="清除类型筛选"
                                                                          onClick={() => selectGenre()}
                                                                          sx={{ml: 'auto'}}><CloseIcon
                                fontSize="small"/></IconButton></Tooltip>}
                        </Box>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: {xs: 1.25, sm: 2}
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
                                        <Box sx={{pt: 1, pb: 0.5, minWidth: 0}}>
                                            <Typography variant="body2" fontWeight={650} noWrap
                                                        title={title}>{title || '未命名作品'}</Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap component="div"
                                                        title={seasonLabel} sx={{mt: 0.25}}>
                                                {seasonLabel}{year ? ` · ${year}` : ''}
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
                                            setParams(next, {replace: true});
                                        }}/>
                        </Box>}
                    </Box>
                </Box>
            )}
        </Container>
    );
}
