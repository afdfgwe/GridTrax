/**
 * WebDAV Service
 *
 * Provides upload and download of a JSON data file via the WebDAV protocol.
 * Uses Basic Authentication over HTTPS (or HTTP for local servers).
 *
 * NOTE: Due to browser CORS restrictions, the WebDAV server must be configured
 * to allow cross-origin requests from this app's origin.
 * For Nextcloud/Alist: this is usually enabled by default or via server config.
 */

import type { WebDAVConfig } from '../store/useWebDAVStore';
import type { ProgressData, SyncPayload } from '../types';

function buildHeaders(config: WebDAVConfig): HeadersInit {
    const credentials = btoa(`${config.username}:${config.password}`);
    return {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
    };
}

function resolveUrl(config: WebDAVConfig): string {
    // Normalize: remove trailing slash from url, ensure leading slash on filePath
    const base = config.url.replace(/\/$/, '');
    const path = config.filePath.startsWith('/') ? config.filePath : `/${config.filePath}`;
    return `${base}${path}`;
}

/**
 * Download progress data from WebDAV.
 * Returns null if the file does not exist yet (404).
 * Throws on other errors.
 */
export async function webdavDownload(config: WebDAVConfig): Promise<ProgressData | SyncPayload | null> {
    const url = resolveUrl(config);
    const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(config),
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`WebDAV download failed: ${response.status} ${response.statusText}`);
    }

    try {
        const data = await response.json();
        return data as ProgressData | SyncPayload;
    } catch {
        throw new Error('WebDAV file exists but is not valid JSON.');
    }
}

/**
 * Upload progress data to WebDAV.
 * Creates the directory if needed via MKCOL (best-effort, ignores 405/301 as dir may already exist).
 */
export async function webdavUpload(config: WebDAVConfig, data: ProgressData | SyncPayload): Promise<void> {
    const url = resolveUrl(config);
    const dirUrl = url.substring(0, url.lastIndexOf('/') + 1);

    // Best-effort directory creation (MKCOL)
    if (dirUrl && dirUrl !== config.url.replace(/\/$/, '') + '/') {
        try {
            await fetch(dirUrl, {
                method: 'MKCOL',
                headers: buildHeaders(config),
            });
        } catch {
            // Ignore MKCOL errors (dir may already exist or server may not support it)
        }
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: buildHeaders(config),
        body: JSON.stringify(data, null, 2),
    });

    if (!response.ok) {
        throw new Error(`WebDAV upload failed: ${response.status} ${response.statusText}`);
    }
}

/**
 * Merge strategy: keep the record with the more recent `last_sync` timestamp.
 * For individual records, the remote wins on conflict (server as source of truth).
 */
export function mergeProgressData(local: ProgressData, remote: ProgressData): ProgressData {
    const mergedRecords = { ...remote.records, ...local.records };
    // If a key exists in both, prefer the one from the newer overall sync
    if (remote.last_sync > local.last_sync) {
        // Remote is newer, remote records take priority for conflicts
        Object.keys(remote.records).forEach((key) => {
            mergedRecords[key] = remote.records[key];
        });
        Object.keys(local.records).forEach((key) => {
            if (!(key in remote.records)) {
                mergedRecords[key] = local.records[key];
            }
        });
    }
    return {
        user_id: local.user_id,
        last_sync: Math.max(local.last_sync, remote.last_sync),
        records: mergedRecords,
    };
}
