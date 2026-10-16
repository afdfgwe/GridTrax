import MovieIcon from '@mui/icons-material/Movie';
import {AppBar, Box, Container, Toolbar, Typography, useScrollTrigger} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import DataBackupPanel from './DataBackupPanel';
import SearchBar from './SearchBar';
import ThemePicker from './ThemePicker';

interface Props {
    children: React.ReactElement<{ elevation?: number; sx?: SxProps<Theme> }>;
}

/** 根据是否离开页面顶部，为固定导航栏附加半透明背景、模糊与分隔线。 */
function ElevationScroll(props: Props) {
    const {children} = props;
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0,
    });

    const theme = useTheme();

    return React.cloneElement(children, {
        elevation: 0,
        sx: {
            backgroundColor: trigger
                ? alpha(theme.palette.background.default, 0.85)
                : 'transparent',
            backdropFilter: trigger ? 'blur(12px)' : 'none',
            borderBottom: trigger ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
            transition: 'background-color 0.3s, backdrop-filter 0.3s, border-bottom 0.3s',
        }
    });
}

interface LayoutProps {
    children: React.ReactNode;
}

/** 全站公共框架：固定工具栏与页面主体，搜索、备份、主题入口跨页面保留。 */
const Layout: React.FC<LayoutProps> = ({children}) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'background.default'}}>
            <ElevationScroll>
                <AppBar position="fixed" color="transparent" elevation={0}
                        sx={{zIndex: (theme) => theme.zIndex.drawer + 1}}>
                    <Container maxWidth="xl">
                        <Toolbar disableGutters sx={{justifyContent: 'space-between'}}>
                            {/* 移动端展开搜索时隐藏标识，为输入框和右侧工具留出空间。 */}
                            <Box
                                component={Link}
                                to="/"
                                sx={{
                                    display: {xs: isSearchExpanded ? 'none' : 'flex', sm: 'flex'},
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    gap: {xs: 1, sm: 1.5},
                                    flexShrink: 0
                                }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 40,
                                        height: 40,
                                        borderRadius: '8px',
                                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                        color: 'primary.main',
                                    }}
                                >
                                    <MovieIcon/>
                                </Box>
                                <Typography
                                    variant="h6"
                                    noWrap
                                    sx={{
                                        fontWeight: 800,
                                        letterSpacing: 0,
                                        background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    GridTrax
                                </Typography>
                            </Box>

                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: {xs: 0.5, sm: 1},
                                minWidth: 0,
                                flexGrow: {xs: isSearchExpanded ? 1 : 0, sm: 0},
                                justifyContent: 'flex-end'
                            }}>
                                <SearchBar onExpandChange={setIsSearchExpanded}/>
                                <Box sx={{display: 'flex', alignItems: 'center', gap: {xs: 0.5, sm: 1}, flexShrink: 0}}>
                                    <DataBackupPanel/>
                                    <ThemePicker/>
                                </Box>
                            </Box>
                        </Toolbar>
                    </Container>
                </AppBar>
            </ElevationScroll>
            {/* 顶部内边距为固定工具栏预留位置，防止正文被覆盖。 */}
            <Box component="main" sx={{flexGrow: 1, pt: {xs: 8, sm: 9}, pb: 4}}>
                {children}
            </Box>
        </Box>
    );
};

export default Layout;
