import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import {
    Alert, Box, Button, ButtonBase, CircularProgress, Dialog, DialogTitle, IconButton,
    Skeleton, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useCallback, useEffect, useRef, useState} from 'react';
import {getCountries, getMediaImages, getPosterUrl} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import type {TMDBCountry, TMDBMediaImages} from '../types';
import {getMediaImageMetadata, withCurrentMediaImage} from '../utils/mediaImages';
import type {MediaImageKind} from '../utils/mediaImages';
import MediaImageSlides from './MediaImageSlides';

const labels = {backdrops: '剧照', posters: '海报'};
const kinds: MediaImageKind[] = ['backdrops', 'posters'];
type Selection = { kind: MediaImageKind; path: string };

/** 仅在两类均有图片时提供切换，避免出现没有内容的选项。 */
function ImageKinds({value, available, onChange}: {
    value: MediaImageKind; available: MediaImageKind[]; onChange: (kind: MediaImageKind) => void;
}) {
    if (available.length < 2) return null;
    return <ToggleButtonGroup size="small" exclusive value={value} aria-label="图片分类"
                              onChange={(_, kind: MediaImageKind | null) => {
                                  if (kind) onChange(kind);
                              }}>
        {available.map(kind => <ToggleButton key={kind} value={kind}
                                             sx={{
                                                 py: 0.25,
                                                 px: 1.25,
                                                 fontSize: '0.75rem'
                                             }}>{labels[kind]}</ToggleButton>)}
    </ToggleButtonGroup>;
}

/** 通过图片路径定位，不依赖预览索引；当前主海报置顶后也不会打开错图。 */
function MediaImageViewer({name, images, initial, loading, error, retry, onClose}: {
    name: string; images: TMDBMediaImages; initial: Selection; loading: boolean;
    error: string | undefined; retry: () => void; onClose: () => void;
}) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [selection, setSelection] = useState(initial);
    const hasCountryCodes = kinds.some(kind => images[kind].some(photo => photo.iso_3166_1?.trim()));
    // 仅在大图相册含国家代码时加载字典，与制片信息共用 API 层缓存。
    const loadCountries = useCallback(
        () => hasCountryCodes ? getCountries() : Promise.resolve<TMDBCountry[]>([]),
        [hasCountryCodes],
    );
    const {data: countries} = useAsyncResource('media-image-countries:zh-CN', loadCountries);
    const closeRef = useRef<HTMLButtonElement>(null);
    const slideRef = useRef<HTMLDivElement>(null);
    const available = kinds.filter(kind => images[kind].length > 0);
    const photos = images[selection.kind];
    const index = Math.max(0, photos.findIndex(photo => photo.file_path === selection.path));
    const active = photos[index];
    const move = (direction: number) => {
        const track = slideRef.current;
        const target = Math.max(0, Math.min(photos.length - 1, index + direction));
        track?.scrollTo({
            left: target * track.clientWidth,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
        });
    };

    return <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg"
                   aria-labelledby="media-gallery-title" onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        // 分类控件保留原生左右键操作，大图区域的方向键用于切换图片。
        if ((event.target as HTMLElement).closest('[role="group"][aria-label="图片分类"]')) return;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            move(-1);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            move(1);
        }
    }} slotProps={{
        paper: {
            sx: {
                borderRadius: fullScreen ? 0 : 2, overflow: 'hidden',
                height: fullScreen ? '100dvh' : 'min(850px, calc(100dvh - 64px))',
                maxHeight: fullScreen ? '100dvh' : 'calc(100dvh - 64px)', pb: 'env(safe-area-inset-bottom)'
            }
        }
    }}>
        <DialogTitle sx={{
            display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, flexShrink: 0,
            pt: fullScreen ? 'max(8px, env(safe-area-inset-top))' : 1
        }}>
            <Typography id="media-gallery-title" component="span" sx={{
                flex: 1, minWidth: 0, fontSize: '1rem',
                fontWeight: 700, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>{name}</Typography>
            {loading && <CircularProgress size={16} aria-label="正在加载影视相册"/>}
            <Typography component="span" variant="caption" color="text.secondary" aria-live="polite"
                        sx={{
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums'
                        }}>{index + 1} / {photos.length}</Typography>
            <Tooltip title="关闭"><IconButton ref={closeRef} autoFocus aria-label="关闭影视相册" onClick={onClose}><CloseIcon/></IconButton></Tooltip>
        </DialogTitle>
        {available.length > 1 && <Box sx={{px: 2, pb: 1, flexShrink: 0}}>
            <ImageKinds value={selection.kind} available={available}
                        onChange={kind => setSelection({kind, path: images[kind][0].file_path})}/>
        </Box>}
        {error && <Alert severity="warning" sx={{mx: 2, mb: 1}} action={<Button color="inherit" size="small"
                                                                                onClick={() => {
                                                                                    closeRef.current?.focus();
                                                                                    retry();
                                                                                }}>重试</Button>}>相册加载失败，仍可查看当前图片</Alert>}
        {active && <>
            <MediaImageSlides key={selection.kind} photos={photos} index={index} name={name} trackRef={slideRef}
                              onChange={value => setSelection({kind: selection.kind, path: photos[value].file_path})}/>
            <Box component="dl" aria-label="图片信息" aria-live="polite" sx={{
                display: 'grid',
                gridTemplateColumns: {xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))'},
                columnGap: 2,
                rowGap: 1,
                m: 0,
                px: {xs: 2, sm: 3},
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                flexShrink: 0
            }}>
                {getMediaImageMetadata(active, countries).map(item => <Box key={item.label} sx={{minWidth: 0}}>
                    <Typography component="dt" variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography component="dd" variant="body2" sx={{
                        m: 0, fontWeight: 600, overflowWrap: 'anywhere',
                        fontVariantNumeric: 'tabular-nums'
                    }}>{item.value}</Typography>
                </Box>)}
            </Box>
        </>}
    </Dialog>;
}

interface MediaImageGalleryProps {
    mediaId: number;
    mediaType: 'movie' | 'tv';
    name: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    posterOpen: boolean;
    onPosterClose: () => void;
}

/** 页面只预览前十张；打开查看器后可浏览完整相册，请求失败不影响详情或观看记录。 */
export default function MediaImageGallery({
                                              mediaId, mediaType, name, posterPath, backdropPath,
                                              posterOpen, onPosterClose
                                          }: MediaImageGalleryProps) {
    const load = useCallback(() => getMediaImages(mediaType, mediaId), [mediaId, mediaType]);
    const {data, error, loading, retry} = useAsyncResource(`media-images:${mediaType}:${mediaId}`, load);
    const [preferredKind, setPreferredKind] = useState<MediaImageKind>('backdrops');
    const [selection, setSelection] = useState<Selection | null>(null);
    const available = kinds.filter(kind => (data?.[kind].length ?? 0) > 0);
    const kind = available.includes(preferredKind) ? preferredKind : available[0] ?? 'backdrops';
    const previews = data?.[kind].slice(0, 10) ?? [];
    const listRef = useRef<HTMLDivElement>(null);
    const [scroll, setScroll] = useState({previous: false, next: false});
    const updateScroll = useCallback(() => {
        const element = listRef.current;
        if (element) setScroll({
            previous: element.scrollLeft > 1,
            next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1
        });
    }, []);
    useEffect(() => {
        const element = listRef.current;
        if (!element) return;
        const observer = new ResizeObserver(updateScroll);
        observer.observe(element);
        if (element.firstElementChild) observer.observe(element.firstElementChild);
        return () => observer.disconnect();
    }, [data, kind, updateScroll]);
    const move = (direction: number) => {
        const element = listRef.current;
        element?.scrollBy({
            left: direction * element.clientWidth * 0.8,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
    };
    const viewerImages = {
        id: mediaId, backdrops: withCurrentMediaImage(data?.backdrops ?? [], backdropPath),
        posters: withCurrentMediaImage(data?.posters ?? [], posterPath)
    };
    const activeSelection = selection ?? (posterOpen && posterPath ? {
        kind: 'posters' as const,
        path: posterPath
    } : null);

    return <>
        {(loading || error || previews.length > 0) && <Box component="section" aria-labelledby="media-images-heading"
                                                           sx={{
                                                               mt: 3,
                                                               pt: 2.5,
                                                               borderTop: 1,
                                                               borderColor: 'divider',
                                                               minWidth: 0
                                                           }}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap'}}>
                <Typography id="media-images-heading" component="h2" variant="h6" fontWeight={700}
                            sx={{mr: 'auto'}}>剧照与海报</Typography>
                <ImageKinds value={kind} available={available} onChange={value => {
                    setPreferredKind(value);
                    listRef.current?.scrollTo({left: 0});
                }}/>
                {!loading && !error && <Box sx={{display: {xs: 'none', sm: 'flex'}}}>
                    <Tooltip title="向前浏览"><span><IconButton size="small" aria-label="向前浏览相册" disabled={!scroll.previous}
                                                            onClick={() => move(-1)}><ChevronLeftIcon fontSize="small"/></IconButton></span></Tooltip>
                    <Tooltip title="向后浏览"><span><IconButton size="small" aria-label="向后浏览相册" disabled={!scroll.next}
                                                            onClick={() => move(1)}><ChevronRightIcon fontSize="small"/></IconButton></span></Tooltip>
                </Box>}
            </Box>
            {loading ? <Box sx={{display: 'flex', gap: 1.5, overflow: 'hidden'}}>
                {[0, 1, 2].map(value => <Skeleton key={value} variant="rounded" sx={{
                    width: 240,
                    aspectRatio: '16/9',
                    height: 'auto',
                    flexShrink: 0
                }}/>)}
            </Box> : error ? <Alert severity="warning" action={<Button color="inherit" size="small"
                                                                       onClick={retry}>重试</Button>}>相册暂时无法加载</Alert> :
                <Box ref={listRef} onScroll={updateScroll} role="region" aria-label={`${labels[kind]}预览`}
                     sx={{overflowX: 'auto', scrollbarWidth: 'thin', overscrollBehaviorX: 'contain', pb: 1}}>
                    <Box sx={{display: 'flex', gap: 1.5, width: 'max-content'}}>
                        {previews.map((photo, index) => <ButtonBase key={`${kind}:${photo.file_path}`}
                                                                    aria-label={`查看第${index + 1}张${labels[kind]}`}
                                                                    onClick={() => setSelection({
                                                                        kind,
                                                                        path: photo.file_path
                                                                    })}
                                                                    sx={{
                                                                        display: 'block',
                                                                        flexShrink: 0,
                                                                        overflow: 'hidden',
                                                                        borderRadius: 1,
                                                                        bgcolor: 'action.hover',
                                                                        width: kind === 'backdrops' ? {
                                                                            xs: 240,
                                                                            sm: 280
                                                                        } : {xs: 104, sm: 120},
                                                                        aspectRatio: kind === 'backdrops' ? '16/9' : '2/3',
                                                                        '&.Mui-focusVisible': {
                                                                            outline: '2px solid',
                                                                            outlineColor: 'primary.main',
                                                                            outlineOffset: -2
                                                                        }
                                                                    }}>
                            <Box component="img"
                                 src={getPosterUrl(photo.file_path, kind === 'backdrops' ? 'w780' : 'w342')}
                                 alt={`${name}的${labels[kind]}${index + 1}`} loading="lazy" decoding="async"
                                 sx={{width: '100%', height: '100%', display: 'block', objectFit: 'cover'}}/>
                        </ButtonBase>)}
                    </Box>
                </Box>}
        </Box>}
        {activeSelection && <MediaImageViewer key={`${activeSelection.kind}:${activeSelection.path}`} name={name}
                                              images={viewerImages} initial={activeSelection} loading={loading}
                                              error={error} retry={retry}
                                              onClose={() => {
                                                  setSelection(null);
                                                  onPosterClose();
                                              }}/>}
    </>;
}
