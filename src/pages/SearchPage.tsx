import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Grid,
    IconButton,
    Tab,
    Tabs,
    Tooltip,
    Typography
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import React, {useCallback, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {searchCollections, searchMediaCategory, searchMulti} from '../api/tmdb';
import MediaCard from '../components/MediaCard';
import PersonSearchCard from '../components/PersonSearchCard';
import CollectionSearchCard from '../components/CollectionSearchCard';
import type {TMDBSearchResult} from '../types';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {
    getSearchCategory, loadSearchResults, SEARCH_CATEGORIES, type CombinedSearchPage, type SearchCategory,
} from '../utils/searchResults';

/** 搜索结果页以地址栏 q 参数为查询来源，刷新或分享地址后仍能重新执行查询。 */
const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = (searchParams.get('q') || '').trim();
    const category = getSearchCategory(searchParams.get('type'));
    const categoryLabel = SEARCH_CATEGORIES.find(item => item.value === category)?.label ?? '全部';
    const searchKey = JSON.stringify([query, category]);
    // 地址栏可被手动修改，先限制为接口支持的整数页码，再参与请求和按钮计算。
    const requestedPage = Number(searchParams.get('page') || 1);
    const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, 500)) : 1;
    const [pagination, setPagination] = useState<{ key: string; totalPages: number }>();
    // 稳定加载函数的引用，避免普通重渲染触发 useAsyncResource 重新请求。
    const load = useCallback(async (signal: AbortSignal): Promise<CombinedSearchPage> => {
        if (!query) return {results: [], collections: [], total_pages: 0, page: 1};
        let result: CombinedSearchPage;
        if (category === 'all') {
            result = await loadSearchResults(page,
                () => searchMulti(query, page, signal),
                () => searchCollections(query, page, signal));
        } else if (category === 'collection') {
            const response = await searchCollections(query, page, signal);
            result = {...response, results: [], collections: response.results};
        } else {
            const response = await searchMediaCategory(category, query, page, signal);
            result = {...response, collections: []};
        }
        if (!signal.aborted) setPagination({key: searchKey, totalPages: result.total_pages});
        return result;
    }, [query, category, page, searchKey]);
    const {data, error, loading, retry} = useAsyncResource(JSON.stringify([query, category, page]), load);
    const results = data?.results ?? [];
    const collections = data?.collections ?? [];
    const hasResults = results.length > 0 || collections.length > 0;
    // 翻页时保留当前分类的总页数，切换分类不能借用其他分类的分页信息。
    const totalPages = data?.total_pages ?? (pagination?.key === searchKey ? pagination.totalPages : undefined);
    const changeSearch = (nextCategory: SearchCategory, nextPage = 1) => {
        const params = new URLSearchParams(searchParams);
        params.set('q', query);
        if (nextCategory === 'all') params.delete('type');
        else params.set('type', nextCategory);
        if (nextPage === 1) params.delete('page');
        else params.set('page', String(nextPage));
        setSearchParams(params);
    };

    // 电影与电视剧使用各自的详情路由，人物卡片单独提供个人资料入口。
    const handleCardClick = useCallback(
        (item: TMDBSearchResult) => {
            if (item.media_type === 'tv') {
                navigate(`/tv/${item.id}`);
            } else if (item.media_type === 'movie') {
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
                {data?.warning && <Alert severity="warning" sx={{mb: 3}}
                                         action={<Button color="inherit" size="small" onClick={retry}>重试</Button>}>
                    {data.warning}
                </Alert>}

                {query && (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2}}>
                        <Typography variant="h6" sx={{minWidth: 0, overflowWrap: 'anywhere'}}>搜索：{query}</Typography>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0}}>
                            <Tooltip title="上一页"><span><IconButton size="small" aria-label="搜索上一页"
                                                                   disabled={loading || page <= 1}
                                                                   onClick={() => changeSearch(category, page - 1)}><ChevronLeftIcon
                                fontSize="small"/></IconButton></span></Tooltip>
                            <Typography variant="caption" aria-label="搜索页码"
                                        sx={{minWidth: '7ch', textAlign: 'center', whiteSpace: 'nowrap'}}>
                                {page} / {totalPages === undefined ? '…' : Math.max(1, totalPages)}
                            </Typography>
                            <Tooltip title="下一页"><span><IconButton size="small" aria-label="搜索下一页"
                                                                   disabled={loading || !data || page >= data.total_pages}
                                                                   onClick={() => changeSearch(category, page + 1)}><ChevronRightIcon
                                fontSize="small"/></IconButton></span></Tooltip>
                        </Box>
                    </Box>
                )}

                {query && <Tabs value={category} onChange={(_, value: string) => changeSearch(getSearchCategory(value))}
                                variant="fullWidth" aria-label="搜索结果分类" sx={{
                    mb: 3, minHeight: 40, borderBottom: 1, borderColor: 'divider',
                    '& .MuiTab-root': {minWidth: 0, minHeight: 40, px: {xs: 0.5, sm: 2}, py: 1},
                }}>
                    {SEARCH_CATEGORIES.map(item => <Tab key={item.value} value={item.value} label={item.label}
                                                        id={`search-tab-${item.value}`}
                                                        aria-controls={`search-panel-${item.value}`}/>)}
                </Tabs>}

                <Box role={query ? 'tabpanel' : undefined} id={`search-panel-${category}`}
                     aria-labelledby={query ? `search-tab-${category}` : undefined} aria-busy={loading}>
                    {loading && query && (
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 8}}>
                            <CircularProgress/>
                        </Box>
                    )}

                    {/* 有关键词且请求成功但结果为空时，按当前分类显示未找到提示。 */}
                    {!loading && !hasResults && query && !error && !data?.warning && (
                        <Box sx={{textAlign: 'center', py: 8}}>
                            <Typography variant="h6" color="text.secondary">
                                没有找到「{query}」相关的{category === 'all' ? '影视作品、人物或合集' : categoryLabel}
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
                    {!loading && hasResults && (
                        <Grid container spacing={2}>
                            {results.map((item) => (
                                <Grid key={`${item.media_type}-${item.id}`} size={{xs: 6, sm: 4, md: 3, lg: 2}}>
                                    {item.media_type === 'person'
                                        ? <PersonSearchCard item={item}/>
                                        : <MediaCard item={item} onClick={handleCardClick}/>}
                                </Grid>
                            ))}
                            {/* 全部分类中，合集仍追加在综合搜索结果之后。 */}
                            {collections.map((item) => (
                                <Grid key={`collection-${item.id}`} size={{xs: 6, sm: 4, md: 3, lg: 2}}>
                                    <CollectionSearchCard item={item}/>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Box>
            </Container>
        </Box>
    );
};

export default SearchPage;
