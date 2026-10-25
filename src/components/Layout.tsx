import MovieIcon from '@mui/icons-material/Movie';
import WhatshotOutlinedIcon from '@mui/icons-material/WhatshotOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import {
    AppBar, Box, Container, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography,
    useMediaQuery, useScrollTrigger,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import React, {useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import BackToTopButton from './BackToTopButton';
import DataBackupPanel from './DataBackupPanel';
import SearchBar from './SearchBar';
import ThemePicker from './ThemePicker';
import StorageWarning from './StorageWarning';

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

/** 窄屏合并浏览入口；切换到宽屏时卸载，避免菜单残留或遮挡独立图标。 */
function BrowseMenu() {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const {pathname} = useLocation();

    return <>
        <Tooltip title="热门榜与影视列表"><IconButton
            id="browse-menu-button" aria-label="热门榜与影视列表"
            aria-haspopup="menu" aria-expanded={Boolean(anchor)}
            aria-controls={anchor ? 'browse-menu' : undefined}
            onClick={event => setAnchor(event.currentTarget)} sx={{color: 'text.secondary'}}>
            <MenuOutlinedIcon/>
        </IconButton></Tooltip>
        <Menu id="browse-menu" anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
              anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
              transformOrigin={{vertical: 'top', horizontal: 'right'}}
              slotProps={{list: {'aria-labelledby': 'browse-menu-button'}}}>
            <MenuItem component={Link} to="/hot" selected={pathname === '/hot'}
                      aria-current={pathname === '/hot' ? 'page' : undefined} onClick={() => setAnchor(null)}>
                <ListItemIcon><WhatshotOutlinedIcon fontSize="small"/></ListItemIcon>
                <ListItemText>热门榜</ListItemText>
            </MenuItem>
            <MenuItem component={Link} to="/lists" selected={pathname === '/lists'}
                      aria-current={pathname === '/lists' ? 'page' : undefined} onClick={() => setAnchor(null)}>
                <ListItemIcon><ListAltOutlinedIcon fontSize="small"/></ListItemIcon>
                <ListItemText>影视列表</ListItemText>
            </MenuItem>
        </Menu>
    </>;
}

/** 全站公共框架：固定工具栏与页面主体，搜索、备份、主题入口跨页面保留。 */
const Layout: React.FC<LayoutProps> = ({children}) => {
    // 搜索组件只上报展开状态；公共布局据此分配空间，不接管输入或查询请求。
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const compactNavigation = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
    const {pathname} = useLocation();

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
                                    '@media (max-width: 359px)': {gap: 0.75},
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
                                        '@media (max-width: 359px)': {width: 32, height: 32},
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
                                        '@media (max-width: 359px)': {fontSize: 17},
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
                                {compactNavigation && !isSearchExpanded && <BrowseMenu/>}
                                <Tooltip title="电影实时热门榜"><IconButton component={Link} to="/hot" aria-label="电影实时热门榜"
                                                                     aria-current={pathname === '/hot' ? 'page' : undefined}
                                                                     sx={{
                                                                         color: 'text.secondary',
                                                                         display: {
                                                                             xs: 'none',
                                                                             sm: 'inline-flex'
                                                                         }
                                                                     }}>
                                    <WhatshotOutlinedIcon/>
                                </IconButton></Tooltip>
                                <Tooltip title="影视列表"><IconButton component={Link} to="/lists" aria-label="影视列表"
                                                                  aria-current={pathname === '/lists' ? 'page' : undefined}
                                                                  sx={{
                                                                      color: 'text.secondary',
                                                                      display: {
                                                                          xs: 'none',
                                                                          sm: 'inline-flex'
                                                                      }
                                                                  }}>
                                    <ListAltOutlinedIcon/>
                                </IconButton></Tooltip>
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
                <StorageWarning/>
                {children}
            </Box>
            <BackToTopButton/>
        </Box>
    );
};

export default Layout;
