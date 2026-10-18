/** 只记住当前标签页的历史位置，限量保留，刷新后由页面默认状态重新开始。 */
export function createNavigationMemory(limit = 60) {
    const entries = new Map<string, { scroll?: number; pages?: Record<string, number> }>();
    return {
        get(key: string) {
            return entries.get(key);
        },
        set(key: string, value: { scroll?: number; pages?: Record<string, number> }) {
            const next = {...entries.get(key), ...value};
            entries.delete(key);
            entries.set(key, next);
            while (entries.size > limit) entries.delete(entries.keys().next().value!);
        },
    };
}

export const navigationMemory = createNavigationMemory();
