import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import {Alert, Box, CircularProgress, IconButton, Tooltip, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useEffect, useRef, useState} from 'react';
import type {PointerEvent} from 'react';
import {getPosterUrl} from '../api/tmdb';
import {clampPhotoPan} from '../utils/personImages';

/** 按照片重建画布，切图时自然重置缩放、拖拽和加载状态。 */
export default function PhotoCanvas({
                                        path,
                                        name,
                                        previous,
                                        next,
                                        label = '人物照片大图',
                                        fallbackSize = 'h632',
                                        nativeSwipe = false,
                                        overlayControls = false
                                    }: {
    path: string; name: string; previous?: () => void; next?: () => void; label?: string; fallbackSize?: string;
    nativeSwipe?: boolean;
    overlayControls?: boolean;
}) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null);
    const [viewport, setViewport] = useState({width: 0, height: 0});
    const [image, setImage] = useState({width: 0, height: 0});
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({x: 0, y: 0});
    const [quality, setQuality] = useState('original');
    const [failed, setFailed] = useState(false);
    const position = clampPhotoPan(pan.x, pan.y, scale, viewport, image);
    const ready = image.width > 0 && !failed;

    useEffect(() => {
        const node = viewportRef.current;
        if (!node) return;
        const observer = new ResizeObserver(([entry]) => {
            setViewport({width: entry.contentRect.width, height: entry.contentRect.height});
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // 切图会卸载旧画布；原焦点若随之消失，继续把键盘操作留在相册中。
        if (document.activeElement === document.body) viewportRef.current?.focus({preventScroll: true});
    }, []);

    const zoom = (value: number) => {
        const bounded = Math.max(1, Math.min(3, value));
        // 到达缩放边界后按钮会禁用，提前转移焦点以保留方向键和 Esc 操作。
        if (bounded === 1 || bounded === 3) viewportRef.current?.focus({preventScroll: true});
        setScale(bounded);
        setPan(clampPhotoPan(position.x, position.y, bounded, viewport, image));
    };
    const endGesture = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
        const start = gesture.current;
        if (!start || start.id !== event.pointerId) return;
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (cancelled || scale !== 1) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        // 原始比例时横向滑动切图；放大后只拖拽，不误触发上一张或下一张。
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
            if (dx < 0) next?.();
            else previous?.();
        }
    };

    return <Box
        sx={{position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0}}>
        <Box sx={{position: 'relative', flex: 1, minHeight: 0, bgcolor: 'action.hover'}}>
            <Box ref={viewportRef} role="region" aria-label={label} tabIndex={0}
                 onPointerDown={event => {
                     if (!event.isPrimary) {
                         gesture.current = null;
                         return;
                     }
                     if (event.button !== 0) return;
                     // 影视相册在原始比例下交给浏览器处理触摸滚动，放大后仍可拖拽看图。
                     if (nativeSwipe && scale === 1 && event.pointerType !== 'mouse') return;
                     gesture.current = {
                         id: event.pointerId, x: event.clientX, y: event.clientY,
                         panX: position.x, panY: position.y
                     };
                     event.currentTarget.setPointerCapture(event.pointerId);
                 }}
                 onPointerMove={event => {
                     const start = gesture.current;
                     if (!start || start.id !== event.pointerId || scale <= 1) return;
                     setPan(clampPhotoPan(start.panX + event.clientX - start.x,
                         start.panY + event.clientY - start.y, scale, viewport, image));
                 }}
                 onPointerUp={event => endGesture(event)}
                 onPointerCancel={event => endGesture(event, true)}
                 onLostPointerCapture={() => {
                     gesture.current = null;
                 }}
                 onDoubleClick={() => {
                     if (ready) zoom(scale > 1 ? 1 : 2);
                 }}
                 sx={{
                     position: 'absolute',
                     inset: 0,
                     overflow: 'hidden',
                     touchAction: nativeSwipe && scale === 1 ? 'pan-x pan-y' : 'none',
                     '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2},
                     userSelect: 'none',
                     cursor: ready && scale > 1 ? 'grab' : 'default',
                     '&:active': {cursor: ready && scale > 1 ? 'grabbing' : 'default'}
                 }}>
                {!failed && <Box component="img" src={getPosterUrl(path, quality)} alt={`${name}的照片`}
                                 draggable={false} decoding="async"
                                 onLoad={event => setImage({
                                     width: event.currentTarget.naturalWidth,
                                     height: event.currentTarget.naturalHeight
                                 })}
                                 onError={() => {
                                     // 原图不可用时退回较小尺寸，不让一次图片失败阻断整个相册。
                                     if (quality === 'original') setQuality(fallbackSize);
                                     else setFailed(true);
                                 }}
                                 sx={{
                                     width: '100%', height: '100%', display: 'block', objectFit: 'contain',
                                     transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
                                 }}/>}
                {!ready && <Box sx={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3}}>
                    {failed ? <Alert severity="warning">这张照片暂时无法加载</Alert> :
                        <CircularProgress size={28} aria-label="正在加载照片"/>}
                </Box>}
            </Box>
            {(previous || next) && <>
                <Tooltip title="上一张"><span><IconButton aria-label="上一张照片" disabled={!previous} onClick={previous}
                                                       sx={{
                                                           position: 'absolute',
                                                           top: '50%',
                                                           left: {xs: 4, sm: 12},
                                                           transform: 'translateY(-50%)',
                                                           bgcolor: 'background.paper',
                                                           boxShadow: 1,
                                                           '&:hover': {bgcolor: 'background.paper'},
                                                           '&.Mui-disabled': {visibility: 'hidden'}
                                                       }}><ChevronLeftIcon/></IconButton></span></Tooltip>
                <Tooltip title="下一张"><span><IconButton aria-label="下一张照片" disabled={!next} onClick={next}
                                                       sx={{
                                                           position: 'absolute',
                                                           top: '50%',
                                                           right: {xs: 4, sm: 12},
                                                           transform: 'translateY(-50%)',
                                                           bgcolor: 'background.paper',
                                                           boxShadow: 1,
                                                           '&:hover': {bgcolor: 'background.paper'},
                                                           '&.Mui-disabled': {visibility: 'hidden'}
                                                       }}><ChevronRightIcon/></IconButton></span></Tooltip>
            </>}
        </Box>
        <Box role="group" aria-label="照片缩放工具" sx={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 0.5, flexShrink: 0,
            ...(overlayControls ? {
                position: 'absolute', bottom: 8, right: 8, gap: 0.25, py: 0.125, px: 0.125,
                bgcolor: theme => alpha(theme.palette.background.paper, 0.42),
                backdropFilter: 'blur(6px)', borderRadius: 1,
                transition: 'background-color 150ms ease',
                '&:hover, &:focus-within': {bgcolor: theme => alpha(theme.palette.background.paper, 0.68)},
                '& .MuiIconButton-root': {width: 28, height: 28},
                '& .MuiSvgIcon-root': {fontSize: 18},
            } : {}),
        }}>
            <Tooltip title="缩小"><span><IconButton size="small" aria-label="缩小照片" disabled={!ready || scale <= 1}
                                                  onClick={() => zoom(scale - 0.5)}><ZoomOutIcon
                fontSize="small"/></IconButton></span></Tooltip>
            <Typography component="span" variant="caption"
                        sx={{
                            width: overlayControls ? 34 : 42,
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                {Math.round(scale * 100)}%
            </Typography>
            <Tooltip title="放大"><span><IconButton size="small" aria-label="放大照片" disabled={!ready || scale >= 3}
                                                  onClick={() => zoom(scale + 0.5)}><ZoomInIcon
                fontSize="small"/></IconButton></span></Tooltip>
            <Tooltip title="恢复原始比例"><span><IconButton size="small" aria-label="恢复照片比例" disabled={!ready || scale === 1}
                                                      onClick={() => zoom(1)}><RestartAltIcon
                fontSize="small"/></IconButton></span></Tooltip>
        </Box>
    </Box>;
}
