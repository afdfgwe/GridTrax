import {Alert, Box, Button, CircularProgress, Container, Grid, IconButton, Tooltip, Typography} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import React, {useCallback, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {searchMulti} from '../api/tmdb';
import MediaCard from '../components/MediaCard';
import type {TMDBSearchResult} from '../types';
import {useAsyncResource} from '../hooks/useAsyncResource';

/** 搜索结果页以地址栏 q 参数为查询来源，刷新或分享地址后仍能重新执行查询。 */
const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = (searchParams.get('q') || '').trim();
    const requestedPage = Number(searchParams.get('page') || 1);
    const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, 500)) : 1;
    const [pagination, setPagination] = useState<{ query: string; totalPages: number }>();
    const load = useCallback(async (signal: AbortSignal) => {
        if (!query) return {results: [], total_pages: 0, page: 1};
        const result = await searchMulti(query, page, signal);
        if (!signal.aborted) setPagination({query, totalPages: result.total_pages});
        return result;
    }, [query, page]);
    const {data, error, loading, retry} = useAsyncResource(`${query}:${page}`, load);
    const results = data?.results ?? [];
    // 翻页时保留同一关键词的总页数，新关键词不使用旧搜索的分页信息。
    const totalPages = data?.total_pages ?? (pagination?.query === query ? pagination.totalPages : undefined);
    const changePage = (next: number) => setSearchParams({q: query, page: String(next)});

    // 混合搜索的电影与电视剧使用不同详情路由，编号本身不能区分作品类型。
    const handleCardClick = useCallback(
        (item: TMDBSearchResult) => {
            if (item.media_type === 'tv') {
                navigate(`/tv/${item.id}`);
            } else {
                navigate(`/movie/${item.id}`);
            }
        },
        [navigate]
    );

    return (
        <Box sx={{minHeight: '100vh'}}>
            <Container maxWidth="lg" sx={{py: 4}}>
                {error && <Alert severity="error" sx={{mb: 3}} action={<Button color="inherit" size="small"
                                                                               onClick={retry}>重试</Button>}>{error}</Alert>}

                {query && (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2}}>
                        <Typography variant="h6" sx={{minWidth: 0, overflowWrap: 'anywhere'}}>搜索：{query}</Typography>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0}}>
                            <Tooltip title="上一页"><span><IconButton size="small" aria-label="搜索上一页"
                                                                   disabled={loading || page <= 1}
                                                                   onClick={() => changePage(page - 1)}><ChevronLeftIcon
                                fontSize="small"/></IconButton></span></Tooltip>
                            <Typography variant="caption" aria-label="搜索页码"
                                        sx={{minWidth: '7ch', textAlign: 'center', whiteSpace: 'nowrap'}}>
                                {page} / {totalPages === undefined ? '…' : Math.max(1, totalPages)}
                            </Typography>
                            <Tooltip title="下一页"><span><IconButton size="small" aria-label="搜索下一页"
                                                                   disabled={loading || !data || page >= data.total_pages}
                                                                   onClick={() => changePage(page + 1)}><ChevronRightIcon
                                fontSize="small"/></IconButton></span></Tooltip>
                        </Box>
                    </Box>
                )}

                {loading && (
                    <Box sx={{display: 'flex', justifyContent: 'center', py: 8}}>
                        <CircularProgress/>
                    </Box>
                )}

                {/* 有关键词且请求成功但结果为空时，显示未找到提示。 */}
                {!loading && results.length === 0 && query && !error && (
                    <Box sx={{textAlign: 'center', py: 8}}>
                        <Typography variant="h6" color="text.secondary">
                            没有找到「{query}」相关的影视作品
                        </Typography>
                    </Box>
                )}

                {/* 没有关键词时的初始状态，不发起默认搜索。 */}
                {!query && (
                    <Box sx={{textAlign: 'center', py: 8}}>
                        <Typography variant="h6" color="text.secondary">
                            请输入关键词进行搜索
                        </Typography>
                    </Box>
                )}

                {/* 仅在加载结束后展示搜索结果，避免把旧结果当作本次结果。 */}
                {!loading && results.length > 0 && (
                    <Grid container spacing={2}>
                        {results.map((item) => (
                            <Grid key={`${item.media_type}-${item.id}`} size={{xs: 6, sm: 4, md: 3, lg: 2}}>
                                <MediaCard item={item} onClick={handleCardClick}/>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>
        </Box>
    );
};

export default SearchPage;
