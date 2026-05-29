import MovieIcon from '@mui/icons-material/Movie';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { AppBar, Box, Container, IconButton, Menu, Toolbar, Typography, useScrollTrigger } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BangumiSyncPanel from './BangumiSyncPanel';
import SearchBar from './SearchBar';
import SyncPanel from './SyncPanel';
import ThemePicker from './ThemePicker';

interface Props {
    children: React.ReactElement<{ elevation?: number; sx?: SxProps<Theme> }>;
}

function ElevationScroll(props: Props) {
    const { children } = props;
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

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = useState<null | HTMLElement>(null);
    const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    const handleMobileMenuClose = () => {
        setMobileMoreAnchorEl(null);
    };

    const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMobileMoreAnchorEl(event.currentTarget);
    };

    const mobileMenuId = 'primary-search-account-menu-mobile';
    const renderMobileMenu = (
        <Menu
            anchorEl={mobileMoreAnchorEl}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            id={mobileMenuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            open={isMobileMenuOpen}
            onClose={handleMobileMenuClose}
            PaperProps={{
                sx: { 
                    borderRadius: 3, 
                    mt: 1.5,
                    minWidth: 180,
                    p: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                <SyncPanel />
                <BangumiSyncPanel />
                <ThemePicker />
            </Box>
        </Menu>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'background.default' }}>
            <ElevationScroll>
                <AppBar position="fixed" color="transparent" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                    <Container maxWidth="xl">
                        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
                            {/* Logo Section - Hidden on mobile when search is expanded */}
                            <Box
                                component={Link}
                                to="/"
                                sx={{
                                    display: { xs: isSearchExpanded ? 'none' : 'flex', sm: 'flex' },
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    gap: 1.5
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
                                    <MovieIcon />
                                </Box>
                                <Typography
                                    variant="h6"
                                    noWrap
                                    sx={{
                                        fontWeight: 800,
                                        letterSpacing: '-0.5px',
                                        background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    GridTrax
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: { xs: isSearchExpanded ? 1 : 0, sm: 0 }, justifyContent: { xs: isSearchExpanded ? 'center' : 'flex-end', sm: 'flex-end' } }}>
                                <SearchBar onExpandChange={setIsSearchExpanded} />
                                
                                {/* Desktop Menu */}
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
                                    <SyncPanel />
                                    <BangumiSyncPanel />
                                    <ThemePicker />
                                </Box>

                                {/* Mobile Menu Icon - Hidden when search expanded */}
                                <Box sx={{ display: { xs: isSearchExpanded ? 'none' : 'flex', sm: 'none' } }}>
                                    <IconButton
                                        size="large"
                                        aria-label="show more"
                                        aria-controls={mobileMenuId}
                                        aria-haspopup="true"
                                        onClick={handleMobileMenuOpen}
                                        color="inherit"
                                        sx={{ color: 'text.secondary' }}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Toolbar>
                    </Container>
                </AppBar>
            </ElevationScroll>
            {renderMobileMenu}
            <Box component="main" sx={{ flexGrow: 1, pt: { xs: 8, sm: 9 }, pb: 4 }}>
                {children}
            </Box>
        </Box>
    );
};

export default Layout;
