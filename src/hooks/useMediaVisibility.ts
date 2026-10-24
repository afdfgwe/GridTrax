import {useCallback, useEffect, useRef} from 'react';

/** 同一个观察器追踪所有影片，视口前后预留 200px，滚动只更新队列优先级而不触发整页渲染。 */
export function useMediaVisibility() {
    const containerRef = useRef<HTMLDivElement>(null);
    const visible = useRef(new Map<Element, string>());
    // 同一作品可能对应多张卡片（如多季），按媒体键去重后作为加载优先级。
    const getPriorityKeys = useCallback(() => [...new Set(visible.current.values())], []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const visibleNodes = visible.current;
        const tracked = new Set<HTMLElement>();
        const nearby = (node: HTMLElement) => {
            const rect = node.getBoundingClientRect();
            return rect.height > 0 && rect.bottom >= -200 && rect.top <= window.innerHeight + 200;
        };
        const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
            for (const entry of entries) {
                const key = (entry.target as HTMLElement).dataset.mediaKey;
                if (entry.isIntersecting && key) visibleNodes.set(entry.target, key);
                else visibleNodes.delete(entry.target);
            }
        }, {rootMargin: '200px 0px'});

        function syncNodes() {
            for (const node of tracked) {
                if (!container!.contains(node)) {
                    observer?.unobserve(node);
                    tracked.delete(node);
                    visibleNodes.delete(node);
                }
            }
            for (const node of container!.querySelectorAll<HTMLElement>('[data-media-key]')) {
                if (tracked.has(node)) continue;
                tracked.add(node);
                // 首次加载或切换分页时立即测量，不等待观察器异步回调才确定优先卡片。
                if (nearby(node)) visibleNodes.set(node, node.dataset.mediaKey!);
                observer?.observe(node);
            }
        }

        syncNodes();
        const mutations = new MutationObserver(changes => {
            // 评分、年份的文字变化不需要重扫全部卡片，只处理卡片自身的增删。
            if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node =>
                node instanceof HTMLElement && (node.matches('[data-media-key]') || node.querySelector('[data-media-key]'))))) {
                syncNodes();
            }
        });
        mutations.observe(container, {childList: true, subtree: true});
        const scanVisible = () => {
            for (const node of tracked) {
                if (nearby(node)) visibleNodes.set(node, node.dataset.mediaKey!);
                else visibleNodes.delete(node);
            }
        };
        // 老浏览器没有 IntersectionObserver 时仍可按实际视口确定优先级。
        if (!observer) window.addEventListener('scroll', scanVisible, {passive: true});
        return () => {
            observer?.disconnect();
            mutations.disconnect();
            window.removeEventListener('scroll', scanVisible);
            visibleNodes.clear();
        };
    }, []);

    return {containerRef, getPriorityKeys};
}
