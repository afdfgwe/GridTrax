import {Box, CircularProgress, CssBaseline, ThemeProvider} from '@mui/material';
import React, {Suspense, useMemo} from 'react';
import {BrowserRouter, Route, Routes} from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import {useThemeStore} from './store/useThemeStore';
import {createAppTheme} from './theme/theme';
import {getThemeConfig} from './theme/themes';

// 页面按路由延迟加载，首次访问时再下载对应模块，等待期间显示统一加载状态。
const HomePage = React.lazy(() => import('./pages/HomePage'));
const SearchPage = React.lazy(() => import('./pages/SearchPage'));
const HotMoviesPage = React.lazy(() => import('./pages/HotMoviesPage'));
const TvDetailPage = React.lazy(() => import('./pages/TvDetailPage'));
const MovieDetailPage = React.lazy(() => import('./pages/MovieDetailPage'));

const LoadingFallback = () => (
    <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
        <CircularProgress/>
    </Box>
);

/** 组合全局主题、浏览器路由和公共布局；具体业务状态由各页面读取。 */
const App: React.FC = () => {
    const themeId = useThemeStore((state) => state.themeId);

    // 只在主题标识变化时重新创建 MUI 主题，避免普通页面更新重复构建主题对象。
    const theme = useMemo(() => {
        return createAppTheme(getThemeConfig(themeId));
    }, [themeId]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <BrowserRouter>
                {/* 滚动恢复置于路由内、懒加载边界外，可在详情尚未加载时开始等待页面高度。 */}
                <ScrollToTop/>
                <Layout>
                    <Suspense fallback={<LoadingFallback/>}>
                        {/* 首页为追踪面板；详情路由中的 id 均为 TMDB 作品编号。 */}
                        <Routes>
                            <Route path="/" element={<HomePage/>}/>
                            <Route path="/search" element={<SearchPage/>}/>
                            <Route path="/hot" element={<HotMoviesPage/>}/>
                            <Route path="/tv/:id" element={<TvDetailPage/>}/>
                            <Route path="/movie/:id" element={<MovieDetailPage/>}/>
                        </Routes>
                    </Suspense>
                </Layout>
            </BrowserRouter>
        </ThemeProvider>
    );
};

export default App;
