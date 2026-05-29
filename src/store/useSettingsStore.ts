import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    /** TMDB v4 Read Access Token (Bearer). Takes priority over the build-time env var. */
    tmdbApiKey: string;
    setTmdbApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            tmdbApiKey: '',
            setTmdbApiKey: (key) => set({ tmdbApiKey: key }),
        }),
        { name: 'gridtrax-settings' }
    )
);
