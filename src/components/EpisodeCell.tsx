import { Box, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useRef, useState } from 'react';
import type { TMDBEpisode } from '../types';

interface EpisodeCellProps {
    episode: TMDBEpisode;
    watched: boolean;
    onSingleClick: (episodeNumber: number) => void;
    onWatchUpTo: (episodeNumber: number) => void;
    onCommentRequest: (episode: TMDBEpisode) => void;
}

const LONG_PRESS_DURATION = 500;

const EpisodeCell: React.FC<EpisodeCellProps> = ({
    episode,
    watched,
    onSingleClick,
    onWatchUpTo,
    onCommentRequest,
}) => {
    const theme = useTheme();
    const [pressed, setPressed] = useState(false);
    const [ripple, setRipple] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isMenuOpen = Boolean(anchorEl);

    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);
    const didContextMenu = useRef(false);
    // Track touch start position to distinguish tap vs scroll
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMenuClose = (e?: any) => {
        if (e && e.stopPropagation) {
            e.stopPropagation();
            e.preventDefault();
        }
        setAnchorEl(null);
    };

    const triggerRipple = useCallback(() => {
        setRipple(true);
        setTimeout(() => setRipple(false), 350);
    }, []);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (isMenuOpen) return;
            if (e.button !== 0) return;

            const target = e.currentTarget as HTMLElement;
            didLongPress.current = false;
            didContextMenu.current = false;
            setPressed(true);

            longPressTimer.current = setTimeout(() => {
                didLongPress.current = true;
                setPressed(false);
                triggerRipple();
                setAnchorEl(target);
                if (navigator.vibrate) navigator.vibrate(50);
            }, LONG_PRESS_DURATION);
        },
        [isMenuOpen, triggerRipple]
    );

    const handleMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return; // Only trigger single click for left mouse button

            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            setPressed(false);
            if (!didLongPress.current && !didContextMenu.current && !isMenuOpen) {
                triggerRipple();
                onSingleClick(episode.episode_number);
            }
            didContextMenu.current = false;
        },
        [episode.episode_number, isMenuOpen, onSingleClick, triggerRipple]
    );

    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (isMenuOpen) return;

            const touch = e.touches[0];
            touchStartPos.current = { x: touch.clientX, y: touch.clientY };

            const target = e.currentTarget as HTMLElement;
            didLongPress.current = false;
            didContextMenu.current = false;
            setPressed(true);

            longPressTimer.current = setTimeout(() => {
                didLongPress.current = true;
                setPressed(false);
                triggerRipple();
                setAnchorEl(target);
                if (navigator.vibrate) navigator.vibrate(50);
            }, LONG_PRESS_DURATION);
        },
        [isMenuOpen, triggerRipple]
    );

    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            // Always prevent the 300ms synthetic mouse/click events on touch devices
            e.preventDefault();

            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            setPressed(false);

            // Check if touch moved significantly (scroll gesture) — cancel single-click
            if (touchStartPos.current) {
                const touch = e.changedTouches[0];
                const dx = Math.abs(touch.clientX - touchStartPos.current.x);
                const dy = Math.abs(touch.clientY - touchStartPos.current.y);
                touchStartPos.current = null;
                if (dx > 10 || dy > 10) {
                    // User was scrolling, do not trigger action
                    return;
                }
            }

            if (!didLongPress.current && !didContextMenu.current && !isMenuOpen) {
                triggerRipple();
                onSingleClick(episode.episode_number);
            }
            didContextMenu.current = false;
        },
        [episode.episode_number, isMenuOpen, onSingleClick, triggerRipple]
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            // If the finger moved, cancel the long press timer
            if (longPressTimer.current && touchStartPos.current) {
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - touchStartPos.current.x);
                const dy = Math.abs(touch.clientY - touchStartPos.current.y);
                if (dx > 10 || dy > 10) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                    setPressed(false);
                }
            }
        },
        []
    );

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            didContextMenu.current = true;
            triggerRipple();
            setAnchorEl(e.currentTarget as HTMLElement);
        },
        [triggerRipple]
    );

    const primary = theme.palette.primary.main;
    const primaryContrast = theme.palette.primary.contrastText;

    return (
        <>
            {/* Tooltip only shown on pointer:fine (desktop) devices */}
            <Tooltip
                title={
                    <Box>
                        <Typography variant="caption" fontWeight={600}>
                            第 {episode.episode_number} 集
                        </Typography>
                        {episode.name && episode.name !== `第 ${episode.episode_number} 集` && (
                            <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                                {episode.name}
                            </Typography>
                        )}
                        <Typography variant="caption" display="block" sx={{ opacity: 0.6, mt: 0.3 }}>
                            长按/右键打开菜单
                        </Typography>
                    </Box>
                }
                placement="top"
                arrow
                // Disable Tooltip on touch devices to avoid interference
                disableFocusListener
                disableTouchListener
            >
            <Box
                component="button"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                    }
                    setPressed(false);
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onContextMenu={handleContextMenu}
                sx={{
                    position: 'relative',
                    width: { xs: 44, sm: 36 },
                    height: { xs: 44, sm: 36 },
                    minWidth: { xs: 44, sm: 36 },
                    border: 'none',
                    outline: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'transform 120ms ease, background-color 180ms ease, box-shadow 180ms ease',
                    background: watched
                        ? primary
                        : alpha(primary, 0.12),
                    boxShadow: watched
                        ? `0 0 0 2px ${alpha(primary, 0.5)}`
                        : `inset 0 0 0 2px ${alpha(primary, 0.3)}`,
                    transform: pressed ? 'scale(0.82)' : ripple ? 'scale(0.92)' : 'scale(1)',
                    '&:hover': {
                        background: watched ? alpha(primary, 0.85) : alpha(primary, 0.22),
                        boxShadow: `0 0 0 2px ${alpha(primary, 0.7)}`,
                    },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Ripple overlay
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '4px',
                        background: alpha('#fff', ripple ? 0.25 : 0),
                        transition: 'background 350ms ease',
                    },
                    // Touch target ensure >= 44dp on mobile
                    '@media (pointer: coarse)': {
                        width: 44,
                        height: 44,
                        minWidth: 44,
                    },
                    // Allow pan-y scrolling but prevent default tap delay;
                    // touchAction: 'none' would block scroll — use manipulation instead
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
                aria-label={`第 ${episode.episode_number} 集${watched ? '（已看）' : ''}`}
                aria-pressed={watched}
                aria-controls={isMenuOpen ? 'episode-context-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={isMenuOpen ? 'true' : undefined}
            >
                <Typography
                    variant="caption"
                    sx={{
                        color: watched ? primaryContrast : alpha(primary, 0.9),
                        fontWeight: 700,
                        fontSize: '10px',
                        lineHeight: 1,
                        userSelect: 'none',
                        pointerEvents: 'none',
                    }}
                >
                    {episode.episode_number}
                </Typography>
            </Box>
            </Tooltip>

            <Menu
                id="episode-context-menu"
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
                MenuListProps={{
                    'aria-labelledby': 'episode-button',
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                PaperProps={{
                    sx: { borderRadius: 3, mt: 0.5, minWidth: 140 }
                }}
            >
                <MenuItem onClick={(e) => {
                    handleMenuClose(e);
                    onWatchUpTo(episode.episode_number);
                }}>
                    看到这里
                </MenuItem>
                <MenuItem onClick={(e) => {
                    handleMenuClose(e);
                    onCommentRequest(episode);
                }}>
                    添加吐槽
                </MenuItem>
            </Menu>
        </>
    );
};

export default EpisodeCell;
