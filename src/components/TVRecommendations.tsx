import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {Alert, Box, Button, CardActionArea, IconButton, Skeleton, Tooltip, Typography} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';
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

/** 仅显示推荐榜首屏的前十部，横向滚动与主要演员列表保持一致。 */
export default function TVRecommendations({tvId}: {tvId: number}) {
    const load = useCallback(() => getTVRecommendations(tvId), [tvId]);
    const {data, loading, error, retry} = useAsyncResource(`tv-recommendations:${tvId}`, load);
    const results = data?.results.slice(0, 10) ?? [];
    const listRef = useRef<HTMLDivElement>(null);
    const [scroll, setScroll] = useState({previous: false, next: false});
    const updateScroll = useCallback(() => {
        const element = listRef.current;
        if (element) setScroll({previous: element.scrollLeft > 1,
            next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1});
    }, []);

    useEffect(() => {
        const element = listRef.current;
        if (!element) return;
        // 同时观察可视区域和内容宽度，屏幕旋转或窗口缩放后重新判断箭头状态。
        const observer = new ResizeObserver(updateScroll);
        observer.observe(element);
        if (element.firstElementChild) observer.observe(element.firstElementChild);
        return () => observer.disconnect();
    }, [data, updateScroll]);

    const move = (direction: number) => {
        const element = listRef.current;
        element?.scrollBy({left: direction * element.clientWidth * 0.8,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    };

    if (!loading && !error && results.length === 0) return null;

    return (
        <Box component="section" aria-labelledby="tv-recommendations-heading" aria-busy={loading}
             sx={{mt: 4, pt: 2.5, borderTop: 1, borderColor: 'divider', minWidth: 0}}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2}}>
                <Typography id="tv-recommendations-heading" component="h2" variant="h6" fontWeight={700}>猜你喜欢</Typography>
                {!loading && !error && (scroll.previous || scroll.next) && <Box sx={{display: {xs: 'none', sm: 'flex'}, gap: 0.5, flexShrink: 0}}>
                    <Tooltip title="向左查看推荐"><span><IconButton size="small" aria-label="向左查看推荐"
                        disabled={!scroll.previous} onClick={() => move(-1)}><ChevronLeftIcon fontSize="small"/></IconButton></span></Tooltip>
                    <Tooltip title="向右查看推荐"><span><IconButton size="small" aria-label="向右查看推荐"
                        disabled={!scroll.next} onClick={() => move(1)}><ChevronRightIcon fontSize="small"/></IconButton></span></Tooltip>
                </Box>}
            </Box>
            {loading ? (
                <Box aria-label="正在加载推荐" sx={{display: 'flex', gap: 1.5, overflow: 'hidden'}}>
                    {Array.from({length: 6}, (_, index) => (
                        <Box key={index} sx={{width: {xs: 96, sm: 112}, flexShrink: 0}}>
                            <Skeleton variant="rounded" sx={{aspectRatio: '2 / 3', height: 'auto', borderRadius: 1}}/>
                            <Skeleton variant="text" sx={{mt: 0.75}}/>
                        </Box>
                    ))}
                </Box>
            ) : error ? (
                <Alert severity="warning" action={<Button color="inherit" size="small" onClick={retry}>重试</Button>}>推荐加载失败：{error}</Alert>
            ) : (
                <Box ref={listRef} onScroll={updateScroll} tabIndex={0} role="region" aria-label="推荐电视剧列表"
                     sx={{overflowX: 'auto', overscrollBehaviorX: 'contain', scrollbarWidth: 'thin', pb: 1,
                         '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3}}}>
                    <Box component="ul" sx={{m: 0, p: 0, listStyle: 'none', display: 'flex', gap: 1.5, width: 'max-content',
                        '& > li': {width: {xs: 96, sm: 112}, flexShrink: 0, minWidth: 0}}}>
                        {results.map(item => <Box component="li" key={item.id}><RecommendationCard item={item}/></Box>)}
                    </Box>
                </Box>
            )}
        </Box>
    );
}
