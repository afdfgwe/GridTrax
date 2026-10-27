import {Box} from '@mui/material';
import {useLayoutEffect, useRef} from 'react';
import type {RefObject} from 'react';
import {getPosterUrl} from '../api/tmdb';
import type {TMDBMediaImage} from '../types';
import PhotoCanvas from './PhotoCanvas';

/** 原生横向滚动与吸附；只挂载当前大图和相邻预览，避免一次加载完整相册原图。 */
export default function MediaImageSlides({photos, index, name, onChange, trackRef}: {
    photos: readonly TMDBMediaImage[]; index: number; name: string; onChange: (index: number) => void;
    trackRef: RefObject<HTMLDivElement | null>;
}) {
    const indexRef = useRef(index);
    useLayoutEffect(() => {
        indexRef.current = index;
    }, [index]);
    useLayoutEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const align = () => track.scrollTo({left: indexRef.current * track.clientWidth, behavior: 'instant'});
        align();
        let width = track.clientWidth;
        // 信息栏换行只会改变高度，不应打断正在进行的横向滑动。
        const observer = new ResizeObserver(() => {
            if (width === track.clientWidth) return;
            width = track.clientWidth;
            align();
        });
        observer.observe(track);
        return () => observer.disconnect();
    }, [photos, trackRef]);
    const move = (target: number) => {
        const track = trackRef.current;
        if (!track) return;
        track.scrollTo({
            left: target * track.clientWidth,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
        });
    };
    return <Box ref={trackRef} role="region" aria-label="影视图片滑动列表" aria-roledescription="轮播"
                onScroll={event => {
                    const track = event.currentTarget;
                    if (!track.clientWidth) return;
                    const target = Math.max(0, Math.min(photos.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
                    if (target !== index) onChange(target);
                }} sx={{
        display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflowX: 'auto', overflowY: 'hidden',
        scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollbarWidth: 'none',
        '&::-webkit-scrollbar': {display: 'none'}
    }}>
        {photos.map((photo, photoIndex) => <Box key={photo.file_path} role="group" aria-roledescription="幻灯片"
                                                aria-label={`第${photoIndex + 1}张，共${photos.length}张`}
                                                aria-hidden={photoIndex !== index} inert={photoIndex !== index}
                                                sx={{
                                                    display: 'flex', flex: '0 0 100%', minWidth: 0, height: '100%',
                                                    scrollSnapAlign: 'start', scrollSnapStop: 'always'
                                                }}>
            {photoIndex === index ? <PhotoCanvas path={photo.file_path} name={name} label="影视图片大图"
                                                 fallbackSize="w780" nativeSwipe
                                                 previous={index > 0 ? () => move(index - 1) : undefined}
                                                 next={index < photos.length - 1 ? () => move(index + 1) : undefined}/>
                : Math.abs(photoIndex - index) === 1 && <Box component="img" src={getPosterUrl(photo.file_path, 'w780')}
                                                             alt="" draggable={false} decoding="async"
                                                             sx={{
                                                                 width: '100%',
                                                                 height: '100%',
                                                                 objectFit: 'contain'
                                                             }}/>}
        </Box>)}
    </Box>;
}
