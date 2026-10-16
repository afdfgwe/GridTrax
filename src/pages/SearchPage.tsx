import {Alert, Box, CircularProgress, Container, Grid, Typography} from '@mui/material';
import React, {useCallback, useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {searchMulti} from '../api/tmdb';
import MediaCard from '../components/MediaCard';
import type {TMDBSearchResult} from '../types';

/** 搜索结果页以地址栏 q 参数为查询来源，刷新或分享地址后仍能重新执行查询。 */
const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState<TMDBSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 每次请求单独维护加载和错误展示；空关键词只清空结果，不调用接口。
    const doSearch = useCallback((q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        setLoading(true);
        setError(null);
        searchMulti(q)
            .then(setResults)
            .catch(() => setError('搜索失败，请检查网络连接或刷新重试。'))
            .finally(() => setLoading(false));
    }, []);

    // 将查询参数变化后的状态更新放入微任务，在本轮副作用结束后执行。
    useEffect(() => {
        queueMicrotask(() => {
            if (query) {
                doSearch(query);
            } else {
                setResults([]);
            }
        });
    }, [query, doSearch]);

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
                {error && <Alert severity="error" sx={{mb: 3}}>{error}</Alert>}

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
