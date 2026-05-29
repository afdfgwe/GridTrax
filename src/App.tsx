import { Box, CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import React, { Suspense, useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAutoWebDAVSync } from './hooks/useAutoWebDAVSync';
import { useThemeStore } from './store/useThemeStore';
import { createAppTheme } from './theme/theme';

const HomePage = React.lazy(() => import('./pages/HomePage'));
const SearchPage = React.lazy(() => import('./pages/SearchPage'));
const TvDetailPage = React.lazy(() => import('./pages/TvDetailPage'));
const MovieDetailPage = React.lazy(() => import('./pages/MovieDetailPage'));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

const App: React.FC = () => {
  const { getActiveThemeConfig, themeId } = useThemeStore();
  useAutoWebDAVSync();

  const theme = useMemo(() => {
    return createAppTheme(getActiveThemeConfig());
  }, [themeId, getActiveThemeConfig]); // Rebuild theme when themeId changes

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/tv/:id" element={<TvDetailPage />} />
              <Route path="/movie/:id" element={<MovieDetailPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
