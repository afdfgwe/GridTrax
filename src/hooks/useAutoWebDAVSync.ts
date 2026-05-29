/**
 * useAutoWebDAVSync
 *
 * - On mount (page load): bidirectional merge with remote WebDAV data
 * - On visibilitychange → hidden (tab switch/close): upload current data
 *
 * Only runs when WebDAV is configured (url + username + password non-empty).
 */

import { useEffect, useRef } from 'react';
import { mergeProgressData, webdavDownload, webdavUpload } from '../api/webdavService';
import { useBangumiStore } from '../store/useBangumiStore';
import { useProgressStore } from '../store/useProgressStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useWebDAVStore } from '../store/useWebDAVStore';
import type { ProgressData, SyncPayload } from '../types';

export function useAutoWebDAVSync() {
    const { config, isConfigured } = useWebDAVStore();
    const isSyncingRef = useRef(false);

    // ── Load: bidirectional merge when configured ───────────────────────────
    useEffect(() => {
        if (!isConfigured()) return;

        const runSync = async () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            try {
                const remoteData = await webdavDownload(config);
                if (remoteData) {
                    const localData = useProgressStore.getState().data;
                    
                    const isSyncPayload = 'metadata' in remoteData;
                    const remoteProgressData = isSyncPayload ? (remoteData as SyncPayload).progressData : (remoteData as ProgressData);

                    const merged = mergeProgressData(localData, remoteProgressData);
                    
                    if (isSyncPayload) {
                        const payload = remoteData as SyncPayload;
                        if (payload.bangumi?.token) {
                            useBangumiStore.setState({
                                token: payload.bangumi.token,
                                username: payload.bangumi.username || '',
                                userId: payload.bangumi.userId || null,
                                nickname: payload.bangumi.nickname || '',
                                lastSyncAt: payload.bangumi.lastSyncAt || null,
                                autoSyncEnabled: payload.bangumi.autoSyncEnabled ?? false,
                            });
                        }
                        if (payload.settings?.tmdbApiKey) {
                            useSettingsStore.getState().setTmdbApiKey(payload.settings.tmdbApiKey);
                        }
                    }

                    useProgressStore.setState((s) => ({ ...s, data: merged }));
                }
            } catch {
                // Silently fail — don't disrupt the user experience
            } finally {
                isSyncingRef.current = false;
            }
        };

        void runSync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount only

    // ── Close/hide: upload to WebDAV when tab loses visibility ─────────────
    useEffect(() => {
        if (!isConfigured()) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden') return;

            const finalData = { ...useProgressStore.getState().data, last_sync: Date.now() };
            const bangumiState = useBangumiStore.getState();
            const settingsState = useSettingsStore.getState();
            
            const uploadPayload: SyncPayload = {
                metadata: { version: 3, exported_at: new Date().toISOString() },
                progressData: finalData,
                bangumi: {
                    token: bangumiState.token,
                    username: bangumiState.username,
                    userId: bangumiState.userId,
                    nickname: bangumiState.nickname,
                    lastSyncAt: bangumiState.lastSyncAt,
                    autoSyncEnabled: bangumiState.autoSyncEnabled,
                },
                settings: { tmdbApiKey: settingsState.tmdbApiKey },
            };

            // Use keepalive fetch so the request survives tab close.
            // webdavUpload internally uses fetch without keepalive, so we
            // call it in the synchronous handler. Most browsers will complete
            // in-flight fetch requests for a short window after the page hides.
            void webdavUpload(config, uploadPayload).catch(() => {
                // Silently fail
            });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.url, config.username, config.password, config.filePath]);
}
