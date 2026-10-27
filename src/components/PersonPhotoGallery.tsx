import CloseIcon from '@mui/icons-material/Close';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    IconButton,
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useCallback, useEffect, useRef, useState} from 'react';
import {getPersonImages, getPosterUrl} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {getPersonPhotos} from '../utils/personImages';
import PhotoCanvas from './PhotoCanvas';

interface GalleryProps {
    personId: number;
    name: string;
    portrait: string;
    onClose: () => void;
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
        if (selected && strip) strip.scrollTo({
            left: selected.offsetLeft - strip.clientWidth / 2 + selected.clientWidth / 2,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
    }, [index, photos.length]);

    return <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg"
                   aria-labelledby="person-gallery-title" onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            previous?.();
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            next?.();
        }
    }} slotProps={{
        paper: {
            sx: {
                borderRadius: fullScreen ? 0 : 2,
                height: fullScreen ? '100dvh' : 'min(850px, calc(100dvh - 64px))',
                maxHeight: fullScreen ? '100dvh' : 'calc(100dvh - 64px)', overflow: 'hidden',
                pb: 'env(safe-area-inset-bottom)'
            }
        }
    }}>
        <DialogTitle id="person-gallery-heading" sx={{
            display: 'flex', alignItems: 'center', gap: 1, py: 1, px: {xs: 2, sm: 2.5},
            pt: fullScreen ? 'max(8px, env(safe-area-inset-top))' : 1, flexShrink: 0
        }}>
            <Typography id="person-gallery-title" component="span" sx={{
                fontSize: '1rem',
                fontWeight: 700,
                flex: 1,
                minWidth: 0,
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
            }}>
                {name}
            </Typography>
            {loading && <CircularProgress size={16} aria-label="正在加载人物相册"/>}
            {photos.length > 1 &&
                <Typography component="span" variant="caption" color="text.secondary" aria-live="polite"
                            sx={{
                                flexShrink: 0,
                                fontVariantNumeric: 'tabular-nums'
                            }}>{index + 1} / {photos.length}</Typography>}
            <Tooltip title="关闭"><IconButton ref={closeRef} autoFocus aria-label="关闭人物相册" onClick={onClose}><CloseIcon/></IconButton></Tooltip>
        </DialogTitle>
        {error &&
            <Alert severity="warning" sx={{mx: 2, mb: 1}} action={<Button color="inherit" size="small" onClick={() => {
                // 重试提示随请求消失，先移交焦点，避免焦点落回页面导致 Esc 失效。
                closeRef.current?.focus();
                retry();
            }}>重试</Button>}>
                相册加载失败，仍可查看当前头像
            </Alert>}
        {active &&
            <PhotoCanvas key={active.file_path} path={active.file_path} name={name} previous={previous} next={next}/>}
        {photos.length > 1 && <Box ref={stripRef} role="region" aria-label="人物照片缩略图" sx={{
            position: 'relative',
            overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'thin', overscrollBehaviorX: 'contain', px: 2, pb: 1
        }}>
            <Box sx={{display: 'flex', gap: 1, width: 'max-content', mx: 'auto'}}>
                {photos.map((photo, photoIndex) => <Box key={photo.file_path} component="button"
                                                        ref={photoIndex === index ? selectedRef : undefined}
                                                        type="button"
                                                        aria-label={`查看第${photoIndex + 1}张照片`}
                                                        aria-pressed={photoIndex === index}
                                                        onClick={() => setIndex(photoIndex)} sx={{
                    display: 'block',
                    width: {xs: 36, sm: 40},
                    aspectRatio: '2/3',
                    p: 0,
                    overflow: 'hidden',
                    flexShrink: 0,
                    borderRadius: 0.5,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: photoIndex === index ? 'primary.main' : 'transparent',
                    bgcolor: 'action.hover',
                    opacity: photoIndex === index ? 1 : 0.6,
                    '&:hover': {opacity: 1},
                    '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1}
                }}>
                    <Box component="img" src={getPosterUrl(photo.file_path, 'w45')} alt="" loading="lazy"
                         decoding="async"
                         sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                </Box>)}
            </Box>
        </Box>}
    </Dialog>;
}
