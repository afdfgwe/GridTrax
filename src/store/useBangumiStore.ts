import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BangumiState {
    token: string;
    username: string;
    userId: number | null;
    nickname: string;
    lastSyncAt: number | null;
    /** Whether to automatically push status/episode changes to Bangumi on every local update. Default: false. */
    autoSyncEnabled: boolean;
    setToken: (token: string) => void;
    setUserInfo: (info: { username: string; userId: number; nickname: string }) => void;
    clearUser: () => void;
    setAutoSyncEnabled: (enabled: boolean) => void;
}

export const useBangumiStore = create<BangumiState>()(
    persist(
        (set) => ({
            token: '',
            username: '',
            userId: null,
            nickname: '',
            lastSyncAt: null,
            autoSyncEnabled: false,
            setToken: (token) => set({ token }),
            setUserInfo: ({ username, userId, nickname }) =>
                set({ username, userId, nickname }),
            clearUser: () =>
                set({ token: '', username: '', userId: null, nickname: '' }),
            setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),
        }),
        { name: 'gridtrax-bangumi' }
    )
);
