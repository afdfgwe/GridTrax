import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WebDAVConfig {
    url: string;
    username: string;
    password: string;
    filePath: string; // remote path, e.g. /gridtrax/data.json
}

interface WebDAVState {
    config: WebDAVConfig;
    setConfig: (config: WebDAVConfig) => void;
    isConfigured: () => boolean;
}

export const useWebDAVStore = create<WebDAVState>()(
    persist(
        (set, get) => ({
            config: {
                url: '',
                username: '',
                password: '',
                filePath: '/gridtrax/data.json',
            },
            setConfig: (config) => set({ config }),
            isConfigured: () => {
                const { url, username, password } = get().config;
                return !!(url && username && password);
            },
        }),
        {
            name: 'gridtrax-webdav-config',
        }
    )
);
