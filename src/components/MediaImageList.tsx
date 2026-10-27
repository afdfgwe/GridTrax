import {Box, Skeleton, Tooltip, Typography} from '@mui/material';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {TMDBCountry, TMDBMediaImage} from '../types';
import {getMediaImageMetadata} from '../utils/mediaImages';
import type {MediaImageKind} from '../utils/mediaImages';
import PhotoCanvas from './PhotoCanvas';

/** 纵向浏览响应式图片网格；仅挂载视口附近的大图，信息栏始终紧跟对应图片。 */
export default function MediaImageList({photos, index, name, kind, countries, onChange}: {
    photos: readonly TMDBMediaImage[]; index: number; name: string; kind: MediaImageKind;
    countries?: readonly TMDBCountry[]; onChange: (index: number) => void;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const indexRef = useRef(index);
    const [nearby, setNearby] = useState(() => new Set([photos[index]?.file_path]));
    useLayoutEffect(() => {
        indexRef.current = index;
    }, [index]);
    // 只在图片列表变化时定位，正常滚动更新页码不会把用户拉回图片顶部。
    useLayoutEffect(() => {
        const list = listRef.current;
        const target = list?.children[indexRef.current] as HTMLElement | undefined;
        if (list && target) list.scrollTo({top: target.offsetTop, behavior: 'instant'});
    }, [photos]);
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const observer = new IntersectionObserver(entries => {
            setNearby(previous => {
                const next = new Set(previous);
                for (const entry of entries) {
                    const path = (entry.target as HTMLElement).dataset.path!;
                    if (entry.isIntersecting || entry.target.contains(document.activeElement)) next.add(path);
                    else next.delete(path);
                }
                return next.size === previous.size && [...next].every(path => previous.has(path)) ? previous : next;
            });
        }, {root: list, rootMargin: '100% 0px'});
        for (const item of list.children) observer.observe(item);
        return () => observer.disconnect();
    }, [photos]);

    return <Box ref={listRef} role="region" aria-label="影视图片纵向列表" tabIndex={0}
                onScroll={event => {
                    const list = event.currentTarget;
                    const items = Array.from(list.children) as HTMLElement[];
                    let target = 0;
                    for (let i = 1; i < items.length && items[i].offsetTop <= list.scrollTop + 1; i++) {
                        if (items[i].offsetTop > items[target].offsetTop) target = i;
                    }
                    // 同排有多张图片时保留用户选中的图片，不让滚动计数跳到相邻图片。
                    if (items[indexRef.current]?.offsetTop === items[target]?.offsetTop) return;
                    if (target >= 0 && target !== indexRef.current) onChange(target);
                }} sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'grid',
        gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: `repeat(${kind === 'posters' ? 4 : 2}, minmax(0, 1fr))`},
        alignContent: 'start',
        alignItems: 'start',
        columnGap: 2,
        rowGap: 2,
        px: {xs: 0, sm: 2},
        pb: 2,
        overscrollBehaviorY: 'contain',
        scrollbarWidth: 'thin',
        overflowAnchor: 'none',
        '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2},
    }}>
        {photos.map((photo, photoIndex) => {
            const ratio = photo.width && photo.height && photo.width > 0 && photo.height > 0
                ? photo.width / photo.height : photo.aspect_ratio && photo.aspect_ratio > 0
                    ? photo.aspect_ratio : kind === 'posters' ? 2 / 3 : 16 / 9;
            return <Box component="figure" key={photo.file_path} data-path={photo.file_path}
                        aria-label={`第${photoIndex + 1}张${kind === 'posters' ? '海报' : '剧照'}`}
                        sx={{m: 0, minWidth: 0}}>
                <Box sx={{
                    display: 'flex', width: '100%', minHeight: 140, maxHeight: '72dvh',
                    aspectRatio: {xs: ratio, md: kind === 'posters' ? '2 / 3' : '16 / 9'},
                }}>
                    {nearby.has(photo.file_path)
                        ? <PhotoCanvas path={photo.file_path} name={name} label={`第${photoIndex + 1}张影视图片大图`}
                                       fallbackSize="w780" nativeSwipe overlayControls/>
                        : <Skeleton variant="rectangular" width="100%" height="100%" animation={false}/>}
                </Box>
                <Box component="figcaption" sx={{px: {xs: 1, sm: 0.5}, pt: 0.75}}>
                    <Box aria-label={`第${photoIndex + 1}张图片信息`} sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 0,
                    }}>
                        {getMediaImageMetadata(photo, countries).map(item => <Tooltip key={item.label}
                                                                                      title={`${item.label}：${item.value}`}>
                            <Typography component="span" aria-label={`${item.label}：${item.value}`}
                                        color="text.secondary" sx={{
                                minWidth: 0,
                                flexShrink: item.label === '尺寸' ? 0 : 1,
                                fontSize: '0.75rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontVariantNumeric: 'tabular-nums',
                            }}>{item.value}</Typography>
                        </Tooltip>)}
                    </Box>
                </Box>
            </Box>;
        })}
    </Box>;
}
