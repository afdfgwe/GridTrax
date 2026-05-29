import { Alert, Box, CircularProgress, Container, Grid, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchMulti } from '../api/tmdb';
import MediaCard from '../components/MediaCard';
import type { TMDBSearchResult } from '../types';

const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState<TMDBSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        queueMicrotask(() => {
            if (query) {
                doSearch(query);
            } else {
                setResults([]);
            }
        });
    }, [query, doSearch]);

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
        <Box sx={{ minHeight: '100vh' }}>
            <Container maxWidth="lg" sx={{ py: 4 }}>
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                )}

                {/* Empty state */}
                {!loading && results.length === 0 && query && !error && (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h6" color="text.secondary">
                            没有找到「{query}」相关的影视作品
                        </Typography>
                    </Box>
                )}

                {/* Landing state */}
                {!query && (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h6" color="text.secondary">
                            请输入关键词进行搜索
                        </Typography>
                    </Box>
                )}

                {/* Results Grid */}
                {!loading && results.length > 0 && (
                    <Grid container spacing={2}>
                        {results.map((item) => (
                            <Grid key={`${item.media_type}-${item.id}`} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                                <MediaCard item={item} onClick={handleCardClick} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>
        </Box>
    );
};

export default SearchPage;
