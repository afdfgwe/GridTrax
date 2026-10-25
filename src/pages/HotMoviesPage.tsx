import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
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
import {darken, lighten} from '@mui/material/styles';
import {Fragment} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import ExpandableOverview from '../components/ExpandableOverview';
import {useHotMovies} from '../hooks/useHotMovies';
import type {HotCategory, HotRow, HotSource, TrendingWindow} from '../types/hotMovies';
import type {TMDBCountry, TMDBGenre} from '../types';
import {parseHotMovieInfo} from '../utils/hotMovieInfo';
import {getTrendingInfo, getTrendingPersonWorks, resolveHotCategory} from '../utils/trendingMovies';
import {getPersonDepartment} from '../utils/personProfile';

const categoryLabels: Record<HotCategory, string> = {movie: '电影', tv: '电视剧', person: '人物'};

/** 两个榜单来源使用不同的数据适配器，最终统一成“标签 + 内容”的展示结构。 */
function HotInfo({
                     row,
                     source,
                     genres,
                     countries
                 }: { row: HotRow; source: HotSource; genres: TMDBGenre[]; countries: TMDBCountry[] }) {
    const parts = source === 'tmdb' ? getTrendingInfo(row.movie, genres, countries) : parseHotMovieInfo(row.item.info);
    if (!parts.length) return null;
    return (
        <Box component="dl" sx={{display: 'grid', rowGap: 0.375, m: 0, mt: 1}}>
            {parts.map(({label, value}) => <Box component="div" key={label}
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'max-content minmax(0, 1fr)',
                                                    columnGap: 0.75,
                                                    alignItems: 'baseline',
                                                    minWidth: 0
                                                }}>
                <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                <Typography component="dd" variant="body2" sx={{
                    m: 0, minWidth: 0, overflowWrap: 'anywhere',
                    color: theme => theme.palette.mode === 'light'
                        ? darken(theme.palette.text.primary, 0.12)
                        : lighten(theme.palette.text.primary, 0.12)
                }}>
                    {value}
                </Typography>
            </Box>)}
        </Box>
    );
}

// 两个来源的评分独立判断，不能把某一来源的分数当成另一来源的缺省值。
function Scores({row}: { row: HotRow }) {
    const {item, movie} = row;
    const douban = typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0;
    const tmdb = typeof movie?.vote_average === 'number' && Number.isFinite(movie.vote_average) && movie.vote_average > 0;
    if (!douban && !tmdb) return null;
    return (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: {xs: 1.5, sm: 2.5}, alignItems: 'baseline', mt: 0.75}}>
            {douban && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">豆瓣</Typography>
                <Typography component="span" sx={{
                    fontSize: 20, lineHeight: 1.2, fontWeight: 800,
                    color: 'warning.main', fontVariantNumeric: 'tabular-nums'
                }}>{item.rating!.toFixed(1)}</Typography>
            </Box>}
            {tmdb && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">TMDB</Typography>
                <Typography component="span" sx={{
                    fontSize: 20, lineHeight: 1.2, fontWeight: 800,
                    color: 'primary.main', fontVariantNumeric: 'tabular-nums'
                }}>{movie!.vote_average!.toFixed(1)}</Typography>
            </Box>}
        </Box>
    );
}

function RankingRow({
                      row,
                      kind,
                      source,
                      genres,
                      countries
                  }: { row: HotRow; kind: HotCategory; source: HotSource; genres: TMDBGenre[]; countries: TMDBCountry[] }) {
    const {item, movie, person, status} = row;
    // 匹配结束后仍无 TMDB 资料时，使用豆瓣条目编号打开原始详情；加载中保留站内搜索。
    const openDouban = source === 'douban' && !movie && (status === 'unmatched' || status === 'error');
    const linkProps = {
        to: person ? `/person/${person.id}` : movie ? `/${kind}/${movie.id}` : openDouban
            ? `https://movie.douban.com/subject/${encodeURIComponent(item.id)}/`
            : `/search?q=${encodeURIComponent(item.title)}`,
        target: openDouban ? '_blank' : undefined,
        rel: openDouban ? 'noopener noreferrer' : undefined,
        'aria-label': openDouban ? `在豆瓣查看${item.title}详情（新标签页打开）`
            : person || movie ? `查看${item.title}详情` : `搜索${item.title}`,
    };
    const showPoster = Boolean(person) || source === 'douban' || Boolean(movie?.poster_path);
    const imagePath = person ? person.profile_path : movie?.poster_path;
    const originalTitle = person ? (person.original_name?.trim() !== item.title ? person.original_name?.trim() : undefined)
        : source === 'tmdb' ? movie?.original_title?.trim() : undefined;
    const department = person ? getPersonDepartment(person.known_for_department) : '';
    const works = person ? getTrendingPersonWorks(person) : [];
    const overview = person ? undefined : source === 'tmdb' ? movie?.overview?.trim() : status === 'error' ? 'TMDB 资料加载失败' :
        status === 'unmatched' ? '暂未匹配到 TMDB 影片' : movie?.overview || '暂无简介';
    return (
        <Box component="li" sx={{
            minWidth: 0, borderBottom: 1, borderColor: 'divider', display: 'grid',
            gridTemplateColumns: person ? {xs: '64px minmax(0, 1fr)', sm: '72px minmax(0, 1fr)'} : showPoster ? {
                xs: '96px minmax(0, 1fr)',
                sm: '140px minmax(0, 1fr)'
            } : 'minmax(0, 1fr)',
            columnGap: person ? 1.5 : {xs: 2, sm: 3}, rowGap: person ? 0 : 1.5,
            py: person ? 1.75 : {xs: 2.5, sm: 3}, px: person ? 0 : {xs: 0, sm: 1},
            ...(!person && {'&:first-of-type': {pt: {xs: 1.5, sm: 2}}})
        }}>
            {showPoster &&
                <Box component={Link} {...linkProps}
                     sx={{
                         position: 'relative', width: '100%', aspectRatio: '2 / 3', alignSelf: 'start',
                         gridRow: person ? 'auto' : {sm: '1 / span 2'}, overflow: 'hidden', borderRadius: 1.5, bgcolor: 'action.hover',
                         '&:hover img': {transform: 'scale(1.035)'},
                         '@media (prefers-reduced-motion: reduce)': {'& img': {transition: 'none'}}
                     }}>
                    {status === 'loading' ? <Skeleton variant="rectangular" width="100%" height="100%"/> : person && !imagePath ?
                        <Box role="img" aria-label={`${item.title}暂无头像`} sx={{
                            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}><PersonOutlineIcon sx={{fontSize: 32, color: 'text.disabled'}}/></Box> :
                        // 前三名通常位于首屏，优先加载海报，其余懒加载。
                        <Box component="img" src={getPosterUrl(imagePath ?? undefined)} alt=""
                             loading={item.rank <= 3 ? 'eager' : 'lazy'}
                             onError={event => {
                                 event.currentTarget.onerror = null;
                                 event.currentTarget.src = '/placeholder-poster.svg';
                             }}
                             sx={{
                                 display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                                 transition: 'transform 250ms ease'
                             }}/>}
                    <Box aria-hidden="true" sx={{
                        position: 'absolute', left: 0, top: 0, px: person ? 0.625 : 1, py: 0.25,
                        bgcolor: item.rank <= 3 ? 'primary.main' : 'rgba(12, 18, 22, 0.88)',
                        color: item.rank <= 3 ? 'primary.contrastText' : '#fff',
                        fontSize: person ? 12 : 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums'
                    }}>
                        {String(item.rank).padStart(2, '0')}
                    </Box>
                </Box>}
            <Box sx={{minWidth: 0}}>
                <Typography component="h2" sx={{
                    fontWeight: 750, fontSize: person ? {xs: 17, sm: 18} : {xs: 18, sm: 23}, lineHeight: 1.35,
                    overflowWrap: 'anywhere'
                }}>
                    <Box component={Link} {...linkProps} sx={{
                        color: 'text.primary', textDecoration: 'none',
                        '&:hover, &:focus-visible': {color: 'primary.main', textDecoration: 'underline'}
                    }}>
                        {item.title}
                    </Box>
                    {department && <Typography component="span" color="text.secondary"
                                               sx={{ml: 1, fontSize: 13, fontWeight: 400}}>{department}</Typography>}
                    {item.year && <Typography component="span" color="text.secondary"
                                              sx={{
                                                  display: 'inline-block', ml: 0.75, fontSize: {xs: 14, sm: 16},
                                                  fontWeight: 400, whiteSpace: 'nowrap'
                                              }}>({item.year})</Typography>}
                </Typography>
                {originalTitle && <Typography color="text.secondary"
                                              sx={{
                                                  mt: 0.375,
                                                  fontWeight: 750,
                                                  fontSize: person ? 13 : {xs: 14, sm: 16},
                                                  lineHeight: 1.4,
                                                  overflowWrap: 'anywhere'
                                              }}>
                    {originalTitle}
                </Typography>}
                {person ? works.length > 0 && <Typography component="div" variant="body2" color="text.secondary"
                                                         sx={{mt: 0.5, fontSize: 13, lineHeight: 1.6, overflowWrap: 'anywhere'}}>
                    {works.map((work, index) => <Fragment key={`${work.kind}-${work.id}`}>
                        {index > 0 && '，'}
                        <Box component={Link} to={`/${work.kind}/${work.id}`} sx={{
                            color: 'text.primary', textDecoration: 'none',
                            '&:hover, &:focus-visible': {color: 'primary.main', textDecoration: 'underline'}
                        }}>{work.title}</Box>
                    </Fragment>)}
                </Typography> : <>
                    <HotInfo row={row} source={source} genres={genres} countries={countries}/>
                    <Scores row={row}/>
                </>}
                {status === 'loading' &&
                    <Box sx={{mt: 2}} aria-label="正在匹配 TMDB"><Skeleton/><Skeleton width="75%"/></Box>}
            </Box>
            {status !== 'loading' && overview && <Box sx={{gridColumn: showPoster ? {xs: '1 / -1', sm: '2'} : '1'}}>
                <ExpandableOverview text={overview} collapsedLines={4}/>
            </Box>}
        </Box>
    );
}

/** 支持豆瓣影视榜及 TMDB 影视、人物日榜和周榜，切换不改动观看记录。 */
export default function HotMoviesPage() {
    // 榜单选项随当前网址保留，详情返回或刷新时恢复，不额外增加切换历史。
    const [searchParams, setSearchParams] = useSearchParams();
    const source: HotSource = searchParams.get('source') === 'tmdb' ? 'tmdb' : 'douban';
    const kind = resolveHotCategory(searchParams.get('kind'), source);
    const timeWindow: TrendingWindow = searchParams.get('window') === 'week' ? 'week' : 'day';
    const changeSelection = (key: 'source' | 'kind' | 'window', value: HotSource | HotCategory | TrendingWindow) => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.set(key, value);
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
    } = useHotMovies(
        activeKind, source, source === 'tmdb' ? timeWindow : 'day',
    );
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
                </ToggleButtonGroup> : <Typography variant="caption" color="text.secondary"
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
