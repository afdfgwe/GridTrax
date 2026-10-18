import {useLayoutEffect} from 'react';
import {useLocation, useNavigationType} from 'react-router-dom';
import {navigationMemory} from '../utils/navigationMemory';

/** 新页面从顶部开始；历史返回等待异步页面撑开后恢复原位置，用户操作时立即停止。 */
const ScrollToTop = () => {
    const {key} = useLocation();
    const navigationType = useNavigationType();

    useLayoutEffect(() => {
        const previous = history.scrollRestoration;
        history.scrollRestoration = 'manual';
        const target = navigationType === 'POP' ? navigationMemory.get(key)?.scroll ?? 0 : 0;
        let lastScroll = target;
        let frame = 0;
        let stopped = false;
        let timeout: number | undefined;
        // 通过尺寸变化等待懒加载内容，不在等待网络期间持续逐帧轮询。
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(restore);
        });
        const remember = () => {
            lastScroll = window.scrollY;
        };
        const stop = () => {
            stopped = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.clearTimeout(timeout);
        };
        const restore = () => {
            if (stopped) return;
            window.scrollTo({top: target, left: 0, behavior: 'instant'});
        };
        window.scrollTo({top: 0, left: 0, behavior: 'instant'});
        // 延迟到路由主体提交后恢复；懒加载期间会继续等待足够的页面高度。
        frame = requestAnimationFrame(restore);
        if (target > 0) {
            observer.observe(document.body);
            timeout = window.setTimeout(stop, 16_000);
        }
        window.addEventListener('scroll', remember, {passive: true});
        window.addEventListener('wheel', stop, {passive: true});
        window.addEventListener('touchstart', stop, {passive: true});
        window.addEventListener('pointerdown', stop, {passive: true});
        window.addEventListener('keydown', stop);
        return () => {
            stop();
            navigationMemory.set(key, {scroll: lastScroll});
            window.removeEventListener('scroll', remember);
            window.removeEventListener('wheel', stop);
            window.removeEventListener('touchstart', stop);
            window.removeEventListener('pointerdown', stop);
            window.removeEventListener('keydown', stop);
            history.scrollRestoration = previous;
        };
    }, [key, navigationType]);

    return null;
};

export default ScrollToTop;
