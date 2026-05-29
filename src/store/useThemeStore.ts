import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BaseThemeConfig } from '../theme/themes';
import { getThemeConfig } from '../theme/themes';

interface ThemeState {
    themeId: string;
    setThemeId: (id: string) => void;
    getActiveThemeConfig: () => BaseThemeConfig;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themeId: 'ocean',
            setThemeId: (id: string) => set({ themeId: id }),
            getActiveThemeConfig: () => getThemeConfig(get().themeId),
        }),
        {
            name: 'gridtrax-theme',
        }
    )
);
