import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import {Alert, Box, Button, CircularProgress, Dialog, DialogTitle, IconButton, Tooltip, Typography, useMediaQuery} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {PointerEvent} from 'react';
import {getPersonImages, getPosterUrl} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {clampPhotoPan, getPersonPhotos} from '../utils/personImages';

interface GalleryProps {
    personId: number;
    name: string;
    portrait: string;
    onClose: () => void;
}

/** 按照片重建画布，切图时自然重置缩放、拖拽和加载状态。 */
function PhotoCanvas({path, name, previous, next}: {
    path: string; name: string; previous?: () => void; next?: () => void;
}) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<{id: number; x: number; y: number; panX: number; panY: number} | null>(null);
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

    return <Box sx={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0}}>
        <Box sx={{position: 'relative', flex: 1, minHeight: 0, bgcolor: 'action.hover'}}>
            <Box ref={viewportRef} role="region" aria-label="人物照片大图" tabIndex={0}
                 onPointerDown={event => {
                     if (!event.isPrimary) { gesture.current = null; return; }
                     if (event.button !== 0) return;
                     gesture.current = {id: event.pointerId, x: event.clientX, y: event.clientY,
                         panX: position.x, panY: position.y};
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
                 onLostPointerCapture={() => { gesture.current = null; }}
                 onDoubleClick={() => { if (ready) zoom(scale > 1 ? 1 : 2); }}
                 sx={{position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none',
                     '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2},
                     userSelect: 'none', cursor: ready && scale > 1 ? 'grab' : 'default',
                     '&:active': {cursor: ready && scale > 1 ? 'grabbing' : 'default'}}}>
                {!failed && <Box component="img" src={getPosterUrl(path, quality)} alt={`${name}的照片`}
                    draggable={false} decoding="async"
                    onLoad={event => setImage({width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight})}
                    onError={() => {
                        // 原图不可用时退回现有头像尺寸，不让一次图片失败阻断整个相册。
                        if (quality === 'original') setQuality('h632');
                        else setFailed(true);
                    }}
                    sx={{width: '100%', height: '100%', display: 'block', objectFit: 'contain',
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`}}/>}
                {!ready && <Box sx={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3}}>
                    {failed ? <Alert severity="warning">这张照片暂时无法加载</Alert> : <CircularProgress size={28} aria-label="正在加载照片"/>}
                </Box>}
            </Box>
            {(previous || next) && <>
                <Tooltip title="上一张"><span><IconButton aria-label="上一张照片" disabled={!previous} onClick={previous}
                    sx={{position: 'absolute', top: '50%', left: {xs: 4, sm: 12}, transform: 'translateY(-50%)',
                        bgcolor: 'background.paper', boxShadow: 1, '&:hover': {bgcolor: 'background.paper'},
                        '&.Mui-disabled': {visibility: 'hidden'}}}><ChevronLeftIcon/></IconButton></span></Tooltip>
                <Tooltip title="下一张"><span><IconButton aria-label="下一张照片" disabled={!next} onClick={next}
                    sx={{position: 'absolute', top: '50%', right: {xs: 4, sm: 12}, transform: 'translateY(-50%)',
                        bgcolor: 'background.paper', boxShadow: 1, '&:hover': {bgcolor: 'background.paper'},
                        '&.Mui-disabled': {visibility: 'hidden'}}}><ChevronRightIcon/></IconButton></span></Tooltip>
            </>}
        </Box>
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 0.5, flexShrink: 0}}>
            <Tooltip title="缩小"><span><IconButton size="small" aria-label="缩小照片" disabled={!ready || scale <= 1}
                onClick={() => zoom(scale - 0.5)}><ZoomOutIcon fontSize="small"/></IconButton></span></Tooltip>
            <Typography component="span" variant="caption" sx={{width: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums'}}>
                {Math.round(scale * 100)}%
            </Typography>
            <Tooltip title="放大"><span><IconButton size="small" aria-label="放大照片" disabled={!ready || scale >= 3}
                onClick={() => zoom(scale + 0.5)}><ZoomInIcon fontSize="small"/></IconButton></span></Tooltip>
            <Tooltip title="恢复原始比例"><span><IconButton size="small" aria-label="恢复照片比例" disabled={!ready || scale === 1}
                onClick={() => zoom(1)}><RestartAltIcon fontSize="small"/></IconButton></span></Tooltip>
        </Box>
    </Box>;
}

/** 仅在用户打开时挂载，请求失败不影响当前头像查看；Dialog 负责焦点恢复和页面滚动锁定。 */
export default function PersonPhotoGallery({personId, name, portrait, onClose}: GalleryProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const load = useCallback(() => getPersonImages(personId), [personId]);
    const {data, error, loading, retry} = useAsyncResource(`person-images:${personId}`, load);
    const photos = getPersonPhotos(portrait, data?.profiles);
    const [index, setIndex] = useState(0);
    const active = photos[index] ?? photos[0];
    const selectedRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const previous = index > 0 ? () => setIndex(value => value - 1) : undefined;
    const next = index < photos.length - 1 ? () => setIndex(value => value + 1) : undefined;

    useEffect(() => {
        const selected = selectedRef.current;
        const strip = stripRef.current;
        if (selected && strip) strip.scrollTo({left: selected.offsetLeft - strip.clientWidth / 2 + selected.clientWidth / 2,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    }, [index, photos.length]);

    return <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg"
        aria-labelledby="person-gallery-title" onKeyDown={event => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === 'ArrowLeft') { event.preventDefault(); previous?.(); }
            if (event.key === 'ArrowRight') { event.preventDefault(); next?.(); }
        }} slotProps={{paper: {sx: {borderRadius: fullScreen ? 0 : 2,
            height: fullScreen ? '100dvh' : 'min(850px, calc(100dvh - 64px))',
            maxHeight: fullScreen ? '100dvh' : 'calc(100dvh - 64px)', overflow: 'hidden',
            pb: 'env(safe-area-inset-bottom)'}}}}>
        <DialogTitle id="person-gallery-heading" sx={{display: 'flex', alignItems: 'center', gap: 1, py: 1, px: {xs: 2, sm: 2.5},
            pt: fullScreen ? 'max(8px, env(safe-area-inset-top))' : 1, flexShrink: 0}}>
            <Typography id="person-gallery-title" component="span" sx={{fontSize: '1rem', fontWeight: 700, flex: 1,
                minWidth: 0, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                {name}
            </Typography>
            {loading && <CircularProgress size={16} aria-label="正在加载人物相册"/>}
            {photos.length > 1 && <Typography component="span" variant="caption" color="text.secondary" aria-live="polite"
                sx={{flexShrink: 0, fontVariantNumeric: 'tabular-nums'}}>{index + 1} / {photos.length}</Typography>}
            <Tooltip title="关闭"><IconButton ref={closeRef} autoFocus aria-label="关闭人物相册" onClick={onClose}><CloseIcon/></IconButton></Tooltip>
        </DialogTitle>
        {error && <Alert severity="warning" sx={{mx: 2, mb: 1}} action={<Button color="inherit" size="small" onClick={() => {
            // 重试提示随请求消失，先移交焦点，避免焦点落回页面导致 Esc 失效。
            closeRef.current?.focus();
            retry();
        }}>重试</Button>}>
            相册加载失败，仍可查看当前头像
        </Alert>}
        {active && <PhotoCanvas key={active.file_path} path={active.file_path} name={name} previous={previous} next={next}/>}
        {photos.length > 1 && <Box ref={stripRef} role="region" aria-label="人物照片缩略图" sx={{position: 'relative',
            overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'thin', overscrollBehaviorX: 'contain', px: 2, pb: 1}}>
            <Box sx={{display: 'flex', gap: 1, width: 'max-content', mx: 'auto'}}>
                {photos.map((photo, photoIndex) => <Box key={photo.file_path} component="button"
                    ref={photoIndex === index ? selectedRef : undefined} type="button"
                    aria-label={`查看第${photoIndex + 1}张照片`} aria-pressed={photoIndex === index}
                    onClick={() => setIndex(photoIndex)} sx={{display: 'block', width: {xs: 36, sm: 40}, aspectRatio: '2/3',
                        p: 0, overflow: 'hidden', flexShrink: 0, borderRadius: 0.5, cursor: 'pointer',
                        border: '2px solid', borderColor: photoIndex === index ? 'primary.main' : 'transparent',
                        bgcolor: 'action.hover', opacity: photoIndex === index ? 1 : 0.6,
                        '&:hover': {opacity: 1}, '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1}}}>
                    <Box component="img" src={getPosterUrl(photo.file_path, 'w45')} alt="" loading="lazy" decoding="async"
                        sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                </Box>)}
            </Box>
        </Box>}
    </Dialog>;
}
