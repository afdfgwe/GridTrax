import CheckIcon from '@mui/icons-material/Check';
import {Box, ListSubheader, Menu, MenuItem, Tooltip, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useCallback, useRef, useState} from 'react';
import type {TMDBEpisode} from '../types';
import {getEpisodeTitle} from './episodeTitle';

/** 单集单元格：短按切换已看，长按或右键打开“看到这里”菜单。 */
interface EpisodeCellProps {
    episode: TMDBEpisode;
    watched: boolean;
    showTitle?: boolean;
    onSingleClick: (episodeNumber: number) => void;
    onWatchUpTo: (episodeNumber: number) => void;
}

// 超过半秒视为长按，后续抬起不再重复触发单集切换。
const LONG_PRESS_DURATION = 500;

const EpisodeCell: React.FC<EpisodeCellProps> = ({
                                                     episode,
                                                     watched,
                                                     showTitle = false,
                                                     onSingleClick,
                                                     onWatchUpTo,
                                                 }) => {
    const theme = useTheme();
    const [pressed, setPressed] = useState(false);
    const [ripple, setRipple] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isMenuOpen = Boolean(anchorEl);

    // 手势过程使用引用保存中间状态，跨事件读取且不为每次指针移动触发渲染。
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);
    const didContextMenu = useRef(false);
    // 记录触摸起点，以位移区分点击和页面滚动。
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    // 菜单关闭既可能来自鼠标项也可能来自组件回调，仅按需访问事件方法。
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
            if (e.button !== 0) return; // 只有鼠标左键抬起才可能触发单集切换。

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
            touchStartPos.current = {x: touch.clientX, y: touch.clientY};

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
            // 事件可取消时阻止触摸后的合成鼠标点击，避免同一次操作重复触发。
            if (e.cancelable) e.preventDefault();

            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            setPressed(false);

            // 位移超过 10 像素视为滚动手势，不把抬起动作当作单击。
            if (touchStartPos.current) {
                const touch = e.changedTouches[0];
                const dx = Math.abs(touch.clientX - touchStartPos.current.x);
                const dy = Math.abs(touch.clientY - touchStartPos.current.y);
                touchStartPos.current = null;
                if (dx > 10 || dy > 10) {
                    // 用户正在滑动页面，保留观看状态不变。
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
            // 明显移动时取消长按计时，防止滚动过程中误弹出菜单。
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

    // 用应用菜单替代浏览器右键菜单，并阻止后续抬起事件切换观看状态。
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
    const episodeTitle = getEpisodeTitle(episode);

    return (
        <>
            {/* 鼠标悬停显示集号和短标题；触摸端通过标题模式或长按菜单阅读。 */}
            <Tooltip
                title={
                    <Box>
                        <Typography variant="caption" fontWeight={600}>
                            第 {episode.episode_number} 集
                        </Typography>
                        {episodeTitle && (
                            <Typography variant="caption" display="block" sx={{opacity: 0.8}}>
                                {episodeTitle}
                            </Typography>
                        )}
                        <Typography variant="caption" display="block" sx={{opacity: 0.6, mt: 0.3}}>
                            长按/右键打开菜单
                        </Typography>
                    </Box>
                }
                placement="top"
                arrow
                // 禁用焦点和触摸触发提示，避免与移动端长按菜单相互干扰。
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
                    onTouchCancel={() => {
                        if (longPressTimer.current) {
                            clearTimeout(longPressTimer.current);
                            longPressTimer.current = null;
                        }
                        touchStartPos.current = null;
                        didLongPress.current = true;
                        setPressed(false);
                    }}
                    onContextMenu={handleContextMenu}
                    sx={{
                        position: 'relative',
                        width: showTitle ? '100%' : {xs: 44, sm: 36},
                        height: showTitle ? 88 : {xs: 44, sm: 36},
                        minWidth: showTitle ? 0 : {xs: 44, sm: 36},
                        boxSizing: 'border-box',
                        p: showTitle ? 1.25 : 0,
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
                        flexDirection: showTitle ? 'column' : 'row',
                        alignItems: showTitle ? 'stretch' : 'center',
                        justifyContent: showTitle ? 'flex-start' : 'center',
                        gap: showTitle ? 0.5 : 0,
                        textAlign: showTitle ? 'left' : 'center',
                        '&:focus-visible': {outline: `2px solid ${primary}`, outlineOffset: 2},
                        // 伪元素只提供短暂的按压反馈，不新增会改变布局的节点。
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '4px',
                            background: alpha('#fff', ripple ? 0.25 : 0),
                            transition: 'background 350ms ease',
                        },
                        // 粗指针设备的方块固定为 44 像素，标题模式保持 88 像素高度。
                        '@media (pointer: coarse)': {
                            width: showTitle ? '100%' : 44,
                            height: showTitle ? 88 : 44,
                            minWidth: showTitle ? 0 : 44,
                        },
                        // 允许浏览器处理滚动等常规触摸操作，避免禁用触摸导致页面无法滑动。
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                    }}
                    aria-label={`第 ${episode.episode_number} 集${showTitle && episodeTitle ? ` ${episodeTitle}` : ''}${watched ? '（已看）' : ''}`}
                    aria-pressed={watched}
                    aria-controls={isMenuOpen ? 'episode-context-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen ? 'true' : undefined}
                >
                    {showTitle ? (
                        <>
                            <Box component="span" sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 0.5,
                                pointerEvents: 'none'
                            }}>
                                <Typography component="span" sx={{
                                    fontSize: '0.75rem',
                                    lineHeight: '18px',
                                    fontWeight: 600,
                                    color: watched ? primaryContrast : 'text.secondary'
                                }}>
                                    第 {episode.episode_number} 集
                                </Typography>
                                <CheckIcon sx={{
                                    width: 16,
                                    height: 16,
                                    flexShrink: 0,
                                    visibility: watched ? 'visible' : 'hidden',
                                    color: primaryContrast
                                }}/>
                            </Box>
                            {episodeTitle && (
                                <Typography
                                    component="span"
                                    sx={{
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden', overflowWrap: 'anywhere', minWidth: 0,
                                        fontSize: '0.8125rem', lineHeight: '20px', fontWeight: 600,
                                        color: watched ? primaryContrast : 'text.primary', pointerEvents: 'none',
                                    }}
                                >
                                    {episodeTitle}
                                </Typography>
                            )}
                        </>
                    ) : <Typography
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
                    </Typography>}
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
                    sx: {borderRadius: 2, mt: 0.5, minWidth: 140, maxWidth: 'min(320px, calc(100vw - 32px))'}
                }}
            >
                <ListSubheader disableSticky sx={{
                    lineHeight: 1.5,
                    py: 1,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    color: 'text.primary'
                }}>
                    第 {episode.episode_number} 集
                    {episodeTitle && <Typography variant="body2" sx={{mt: 0.5}}>{episodeTitle}</Typography>}
                </ListSubheader>
                <MenuItem onClick={(e) => {
                    handleMenuClose(e);
                    onWatchUpTo(episode.episode_number);
                }}>
                    看到这里
                </MenuItem>
            </Menu>
        </>
    );
};

export default EpisodeCell;
