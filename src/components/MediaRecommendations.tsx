import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {Alert, Box, Button, CardActionArea, IconButton, Skeleton, Tooltip, Typography} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {
    getMovieCollection,
    getMovieRecommendations,
    getMovieSimilar,
    getPosterUrl,
    getTVRecommendations,
    getTVSimilar
} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {useProgressStore} from '../store/useProgressStore';
import {getCollectionMovies} from '../utils/movieCollection';
import {STATUS_LABELS} from '../types';
import type {
    TMDBMovieRecommendation,
    TMDBTVRecommendation,
} from '../types';
import CompactCardTitle from './CompactCardTitle';
import PosterScoreBadge from './PosterScoreBadge';

/** 推荐卡片沿用追踪面板的海报比例、年份和评分，整张卡片可键盘或触摸进入详情。 */
function RecommendationCard({item, mediaType, collection = false, currentMovieId}: {
    item: TMDBTVRecommendation | TMDBMovieRecommendation; mediaType: 'movie' | 'tv';
    collection?: boolean; currentMovieId?: number;
}) {
    const [failed, setFailed] = useState(false);
    const status = useProgressStore((state) => collection
        ? state.data.records[`tmdb_movie_${item.id}`]?.global_status : undefined);
    const current = collection && item.id === currentMovieId;
    const title = ('title' in item ? item.title || item.original_title : item.name || item.original_name) || '未知作品';
    const year = ('title' in item ? item.release_date : item.first_air_date)?.slice(0, 4);
    return (
        <CardActionArea component={Link} to={`/${mediaType}/${item.id}`} aria-label={`查看${title}详情`}
                        aria-current={current ? 'page' : undefined}
                        sx={{
                            display: 'block',
                            borderRadius: 1,
                            minWidth: 0,
                            color: 'text.primary',
                            textDecoration: 'none'
                        }}>
            <Box sx={{
                position: 'relative',
                aspectRatio: '2 / 3',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'action.hover'
            }}>
                <Box component="img"
                     src={failed ? '/placeholder-poster.svg' : getPosterUrl(item.poster_path ?? undefined)}
                     alt={title} loading="lazy" decoding="async" onError={() => setFailed(true)}
                     sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                {year && <Typography component="span" variant="caption" sx={{
                    position: 'absolute', top: 2, left: 2,
                    px: 0.5, py: 0.25, borderRadius: 0.75, bgcolor: 'rgba(0, 0, 0, 0.78)', color: '#fff', lineHeight: 1
                }}>{year}</Typography>}
                <PosterScoreBadge score={item.vote_average}/>
            </Box>
            <Box sx={{py: 0.75, px: 0.25}}><CompactCardTitle title={title}/></Box>
            {collection && (current || status) && <Typography variant="caption" component="div"
                                                              sx={{
                                                                  px: 0.25,
                                                                  pb: 0.5,
                                                                  color: current ? 'primary.main' : 'text.secondary'
                                                              }}>
                {current ? '当前影片' : ''}{current && status ? ' · ' : ''}{status ? STATUS_LABELS[status] : ''}
            </Typography>}
        </CardActionArea>
    );
}

type MediaRecommendationsProps = {
    mediaId: number;
} & ({
    mediaType: 'movie' | 'tv';
    kind?: 'recommendations' | 'similar';
    currentMovieId?: never;
} | {
    mediaType: 'movie';
    kind: 'collection';
    currentMovieId: number;
});

type MediaRowData = {
    results: Array<TMDBMovieRecommendation | TMDBTVRecommendation>;
    collectionName?: string;
};

/** 推荐与相似各取前十部；合集保留全部作品，共用横向海报布局与独立加载状态。 */
export default function MediaRecommendations({
                                                 mediaId,
                                                 mediaType,
                                                 kind = 'recommendations',
                                                 currentMovieId,
                                             }: MediaRecommendationsProps) {
    const title = kind === 'collection' ? '同系列电影' : kind === 'similar' ? '相似' : '猜你喜欢';
    const label = kind === 'collection' ? '同系列' : kind === 'similar' ? '相似' : '推荐';
    const mediaLabel = mediaType === 'movie' ? '电影' : '电视剧';
    const headingId = `${mediaType}-${kind}-heading`;
    const load = useCallback((): Promise<MediaRowData> => {
        if (kind === 'collection') {
            return getMovieCollection(mediaId).then((collection) => ({
                results: getCollectionMovies(collection.parts), collectionName: collection.name,
            }));
        }
        if (mediaType === 'movie') {
            return kind === 'similar' ? getMovieSimilar(mediaId) : getMovieRecommendations(mediaId);
        }
        return kind === 'similar' ? getTVSimilar(mediaId) : getTVRecommendations(mediaId);
    }, [mediaId, mediaType, kind]);
    const {data, loading, error, retry} = useAsyncResource<MediaRowData>(
        `${mediaType}-${kind}:${mediaId}`, load);
    const results = (kind === 'collection' ? data?.results : data?.results.slice(0, 10)) ?? [];
    const listRef = useRef<HTMLDivElement>(null);
    const [scroll, setScroll] = useState({previous: false, next: false});
    // 留 1px 容差判断轨道两端是否还有内容，控制左右箭头可用状态。
    const updateScroll = useCallback(() => {
        const element = listRef.current;
        if (element) setScroll({
            previous: element.scrollLeft > 1,
            next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1
        });
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
        element?.scrollBy({
            left: direction * element.clientWidth * 0.8,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
    };

    // 保留电视剧推荐原有的隐藏逻辑；电影推荐和相似列表无数据时明确显示空态。
    if (mediaType === 'tv' && kind === 'recommendations' && !loading && !error && results.length === 0) return null;
    if (kind === 'collection' && !loading && !error && results.length === 0) return null;

    return (
        <Box component="section" aria-labelledby={headingId} aria-busy={loading}
             sx={{mt: kind === 'similar' ? 1.5 : 4, pt: 2.5, borderTop: 1, borderColor: 'divider', minWidth: 0}}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2}}>
                <Box sx={{minWidth: 0}}>
                    <Typography id={headingId} component="h2" variant="h6" fontWeight={700}>{title}</Typography>
                    {data?.collectionName && <Typography variant="body2" color="text.secondary"
                                                         sx={{
                                                             mt: 0.5,
                                                             overflowWrap: 'anywhere'
                                                         }}>{data.collectionName}</Typography>}
                </Box>
                {!loading && !error && results.length > 0 && (scroll.previous || scroll.next) &&
                    <Box sx={{display: {xs: 'none', sm: 'flex'}, gap: 0.5, flexShrink: 0}}>
                        <Tooltip title={`向左查看${label}`}><span><IconButton size="small" aria-label={`向左查看${label}`}
                                                                          disabled={!scroll.previous}
                                                                          onClick={() => move(-1)}><ChevronLeftIcon
                            fontSize="small"/></IconButton></span></Tooltip>
                        <Tooltip title={`向右查看${label}`}><span><IconButton size="small" aria-label={`向右查看${label}`}
                                                                          disabled={!scroll.next}
                                                                          onClick={() => move(1)}><ChevronRightIcon
                            fontSize="small"/></IconButton></span></Tooltip>
                    </Box>}
            </Box>
            {loading ? (
                <Box aria-label={`正在加载${label}`} sx={{display: 'flex', gap: 1.5, overflow: 'hidden'}}>
                    {Array.from({length: 6}, (_, index) => (
                        <Box key={index} sx={{width: {xs: 96, sm: 112}, flexShrink: 0}}>
                            <Skeleton variant="rounded" sx={{aspectRatio: '2 / 3', height: 'auto', borderRadius: 1}}/>
                            <Skeleton variant="text" sx={{mt: 0.75}}/>
                        </Box>
                    ))}
                </Box>
            ) : error ? (
                <Alert severity="warning" action={<Button color="inherit" size="small"
                                                          onClick={retry}>重试</Button>}>{label}加载失败：{error}</Alert>
            ) : results.length === 0 ? (
                <Typography variant="body2" color="text.secondary">暂无{label}{mediaLabel}</Typography>
            ) : (
                <Box ref={listRef} onScroll={updateScroll} tabIndex={0} role="region"
                     aria-label={`${label}${mediaLabel}列表`}
                     sx={{
                         overflowX: 'auto', overscrollBehaviorX: 'contain', scrollbarWidth: 'thin', pb: 1,
                         '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3}
                     }}>
                    <Box component="ul" sx={{
                        m: 0, p: 0, listStyle: 'none', display: 'flex', gap: 1.5, width: 'max-content',
                        '& > li': {width: {xs: 96, sm: 112}, flexShrink: 0, minWidth: 0}
                    }}>
                        {results.map(item => <Box component="li" key={item.id}><RecommendationCard item={item}
                                                                                                   mediaType={mediaType}
                                                                                                   collection={kind === 'collection'}
                                                                                                   currentMovieId={currentMovieId}/></Box>)}
                    </Box>
                </Box>
            )}
        </Box>
    );
}
