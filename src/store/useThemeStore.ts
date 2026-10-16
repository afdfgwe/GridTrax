import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {BaseThemeConfig} from '../theme/themes';
import {getThemeConfig} from '../theme/themes';

/** 主题状态只保存选择标识，实际色值始终从预设配置读取。 */
interface ThemeState {
    themeId: string;
    setThemeId: (id: string) => void;
    getActiveThemeConfig: () => BaseThemeConfig;
}

// 主题偏好与观影进度分开持久化，导入观影备份不会覆盖当前主题选择。
export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themeId: 'ocean',
            setThemeId: (id: string) => set({themeId: id}),
            // 通过统一查找函数处理失效主题标识的兜底。
            getActiveThemeConfig: () => getThemeConfig(get().themeId),
        }),
        {
            name: 'gridtrax-theme',
        }
    )
);
