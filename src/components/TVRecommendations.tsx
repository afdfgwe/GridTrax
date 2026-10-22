import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {Alert, Box, Button, CardActionArea, IconButton, Skeleton, Tooltip, Typography} from '@mui/material';
import {useCallback, useState} from 'react';
import {Link} from 'react-router-dom';
import {getPosterUrl, getTVRecommendations} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import type {TMDBTVRecommendation} from '../types';
import CompactCardTitle from './CompactCardTitle';
import PosterScoreBadge from './PosterScoreBadge';

/** 推荐卡片沿用追踪面板的海报比例、年份和评分，整张卡片可键盘或触摸进入详情。 */
function RecommendationCard({item}: {item: TMDBTVRecommendation}) {
    const [failed, setFailed] = useState(false);
    const title = item.name || item.original_name || '未知作品';
    const year = item.first_air_date?.slice(0, 4);
    return (
        <CardActionArea component={Link} to={`/tv/${item.id}`} aria-label={`查看${title}详情`}
                        sx={{display: 'block', borderRadius: 1, minWidth: 0, color: 'text.primary', textDecoration: 'none'}}>
            <Box sx={{position: 'relative', aspectRatio: '2 / 3', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover'}}>
                <Box component="img" src={failed ? '/placeholder-poster.svg' : getPosterUrl(item.poster_path ?? undefined)}
                     alt={title} loading="lazy" decoding="async" onError={() => setFailed(true)}
                     sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                {year && <Typography component="span" variant="caption" sx={{position: 'absolute', top: 2, left: 2,
                    px: 0.5, py: 0.25, borderRadius: 0.75, bgcolor: 'rgba(0, 0, 0, 0.78)', color: '#fff', lineHeight: 1}}>{year}</Typography>}
                <PosterScoreBadge score={item.vote_average}/>
            </Box>
            <Box sx={{py: 0.75, px: 0.25}}><CompactCardTitle title={title}/></Box>
        </CardActionArea>
    );
}

/** 独立加载推荐；父级以电视剧 ID 作为 key，切换作品时分页及失败状态一并重置。 */
export default function TVRecommendations({tvId}: {tvId: number}) {
    const [page, setPage] = useState(1);
    const [knownTotal, setKnownTotal] = useState<number>();
    const load = useCallback(async (signal: AbortSignal) => {
        const result = await getTVRecommendations(tvId, page);
        // 翻页期间保留已知总页数，忽略卸载或旧页请求，避免页码闪动或串数据。
        if (!signal.aborted) setKnownTotal(result.total_pages);
        return result;
    }, [tvId, page]);
    const {data, loading, error, retry} = useAsyncResource(`tv-recommendations:${tvId}:${page}`, load);
    const totalPages = data?.total_pages ?? knownTotal;
    const results = data?.results ?? [];

    if (!loading && !error && page === 1 && results.length === 0) return null;

    return (
        <Box component="section" aria-labelledby="tv-recommendations-heading" aria-busy={loading}
             sx={{mt: 4, pt: 2.5, borderTop: 1, borderColor: 'divider', minWidth: 0}}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2}}>
                <Typography id="tv-recommendations-heading" component="h2" variant="h6" fontWeight={700}>猜你喜欢</Typography>
                {((totalPages ?? 0) > 1 || page > 1) && <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0}}>
                    <Tooltip title="上一页"><span><IconButton size="small" aria-label="推荐上一页"
                        disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeftIcon fontSize="small"/></IconButton></span></Tooltip>
                    <Typography variant="caption" aria-label="推荐页码" sx={{minWidth: '7ch', textAlign: 'center', whiteSpace: 'nowrap'}}>
                        {page} / {totalPages}
                    </Typography>
                    <Tooltip title="下一页"><span><IconButton size="small" aria-label="推荐下一页"
                        disabled={loading || !data || page >= data.total_pages} onClick={() => setPage(value => value + 1)}><ChevronRightIcon fontSize="small"/></IconButton></span></Tooltip>
                </Box>}
            </Box>
            {error ? (
                <Alert severity="warning" action={<Button color="inherit" size="small" onClick={retry}>重试</Button>}>推荐加载失败：{error}</Alert>
            ) : (
                <Box component="ul" aria-label="推荐电视剧列表" sx={{m: 0, p: 0, listStyle: 'none', display: 'grid',
                    gridTemplateColumns: {xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))'},
                    gap: {xs: 1.25, sm: 2}}}>
                    {loading ? Array.from({length: 20}, (_, index) => (
                        <Box component="li" key={index}>
                            <Skeleton variant="rounded" sx={{aspectRatio: '2 / 3', height: 'auto', borderRadius: 1}}/>
                            <Skeleton variant="text" sx={{mt: 0.75}}/>
                        </Box>
                    )) : results.map(item => <Box component="li" key={item.id} sx={{minWidth: 0}}><RecommendationCard item={item}/></Box>)}
                </Box>
            )}
            {!loading && !error && results.length === 0 && <Typography variant="body2" color="text.secondary">本页暂无推荐</Typography>}
        </Box>
    );
}
