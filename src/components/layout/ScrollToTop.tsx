import {useLayoutEffect} from 'react';
import {useLocation, useNavigationType} from 'react-router-dom';
import {navigationMemory} from '../../utils/storage/navigationMemory';

/** 新页面从顶部开始；局部分页保留位置，历史返回等待异步内容后恢复位置。 */
const ScrollToTop = () => {
    const {key, state} = useLocation();
    const navigationType = useNavigationType();
    const preserveScroll = state?.preserveScroll === true;

    useLayoutEffect(() => {
        const previous = history.scrollRestoration;
        // 关闭浏览器默认恢复，避免它和异步内容加载后的自定义恢复相互抢占。
        history.scrollRestoration = 'manual';
        const target = navigationType === 'POP'
            ? navigationMemory.get(key)?.scroll ?? 0
            : preserveScroll ? window.scrollY : 0;
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
        if (!preserveScroll || navigationType === 'POP') {
            window.scrollTo({top: 0, left: 0, behavior: 'instant'});
        }
        // 延迟到路由主体提交后恢复；懒加载期间会继续等待足够的页面高度。
        frame = requestAnimationFrame(restore);
        if (target > 0) {
            observer.observe(document.body);
            timeout = window.setTimeout(stop, 16_000);
        }
        window.addEventListener('scroll', remember, {passive: true});
        // 一旦用户主动操作，就不再把页面拉回历史位置。
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
    }, [key, navigationType, preserveScroll]);

    return null;
};

export default ScrollToTop;
