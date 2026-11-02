import {Typography} from '@mui/material';
import {useEffect, useRef} from 'react';

/** 手机网格中的长片名仅在可见时向左循环滚动，桌面和减少动态效果模式仍使用省略号。 */
const CompactCardTitle = ({title}: { title: string }) => {
    const containerRef = useRef<HTMLParagraphElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        let active = true;
        container.dataset.visible = 'false';
        const measure = () => {
            if (!active) return;
            const distance = Math.max(0, text.scrollWidth - container.clientWidth);
            container.dataset.overflow = String(distance > 1);
            container.style.setProperty('--title-scroll-distance', `-${distance}px`);
            // 按实际溢出距离延长周期，避免很长的片名为了固定时长而滚动过快。
            container.style.setProperty('--title-scroll-duration', `${Math.max(6, distance / 24 + 3)}s`);
        };

        // 同时监听容器和文字，适配屏幕旋转、网格变化及字体加载后的真实宽度。
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        observer.observe(text);
        // 离开视口时移除动画并复位，重新进入时从片名开头开始播放。
        const visibilityObserver = new IntersectionObserver(([entry]) => {
            if (!active) return;
            container.dataset.visible = String(entry.isIntersecting
                && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0);
        });
        visibilityObserver.observe(container);
        measure();
        void document.fonts.ready.then(measure);
        document.fonts.addEventListener('loadingdone', measure);
        return () => {
            active = false;
            observer.disconnect();
            visibilityObserver.disconnect();
            container.dataset.visible = 'false';
            document.fonts.removeEventListener('loadingdone', measure);
        };
    }, [title]);

    return (
        <Typography ref={containerRef} variant="body2" fontWeight={700} noWrap title={title}
                    sx={(theme) => ({
                        minWidth: 0,
                        '& > span': {
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        },
                        '@keyframes compact-title-scroll': {
                            '0%, 15%': {transform: 'translateX(0)'},
                            '85%, 100%': {transform: 'translateX(var(--title-scroll-distance))'},
                        },
                        [theme.breakpoints.down('sm')]: {
                            '@media (prefers-reduced-motion: no-preference)': {
                                '&[data-overflow="true"][data-visible="true"]': {
                                    textOverflow: 'clip',
                                    '& > span': {
                                        width: 'max-content',
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        animation: 'compact-title-scroll var(--title-scroll-duration) linear infinite',
                                    },
                                },
                            },
                        },
                    })}>
            <span ref={textRef}>{title}</span>
        </Typography>
    );
};

export default CompactCardTitle;
