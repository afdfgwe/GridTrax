// Bangumi API v0 Service
// Docs: https://bangumi.github.io/api/

const BGM_BASE = 'https://api.bgm.tv';

// ── Types from Bangumi API spec ───────────────────────────────────────────────

export interface BangumiUser {
    id: number;
    username: string;
    nickname: string;
    avatar: { large: string; medium: string; small: string };
}

/**
 * SubjectCollectionType (v0 spec):
 *  1 = 想看 (Wish)
 *  2 = 看过 (Done/Collect)
 *  3 = 在看 (Doing/Do)
 *  4 = 搁置 (OnHold)
 *  5 = 抛弃 (Dropped)
 */
export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5;

export interface BangumiUserCollection {
    subject_id: number;
    subject_type: number; // 2 = Anime
    rate: number; // 0-10
    type: BangumiCollectionType;
    comment: string | null;
    ep_status: number; // watched episode count (for anime)
    vol_status: number;
    updated_at: string;
    subject?: {
        id: number;
        name: string;
        name_cn: string;
        type: number;
        images?: { common: string; grid: string; large: string; medium: string; small: string };
    };
}

export interface BangumiSearchResult {
    id: number;
    name: string;
    name_cn: string;
    type: number;
    images?: { common: string; grid: string; large: string; medium: string; small: string };
}

// ── Status Mapping ────────────────────────────────────────────────────────────

import type { WatchStatus } from '../types';

export const GRIDTRAX_TO_BANGUMI: Record<WatchStatus, BangumiCollectionType> = {
    Wish: 1,
    Collect: 2,
    Do: 3,
    OnHold: 4,
    Dropped: 5,
};

export const BANGUMI_TO_GRIDTRAX: Record<BangumiCollectionType, WatchStatus> = {
    1: 'Wish',
    2: 'Collect',
    3: 'Do',
    4: 'OnHold',
    5: 'Dropped',
};

// ── API Helpers ───────────────────────────────────────────────────────────────

function makeHeaders(token: string): HeadersInit {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GridTrax/1.0 (https://github.com/your/repo)',
    };
}

/** GET /v0/me — verify token and get user info */
export async function bangumiGetMe(token: string): Promise<BangumiUser> {
    const res = await fetch(`${BGM_BASE}/v0/me`, {
        headers: makeHeaders(token),
    });
    if (!res.ok) throw new Error(`Bangumi 认证失败 (${res.status})`);
    return res.json() as Promise<BangumiUser>;
}

/** GET /v0/users/{username}/collections — paginated, subject_type=2 (Anime) */
export async function bangumiGetCollections(
    token: string,
    username: string,
    subject_type = 2,
): Promise<BangumiUserCollection[]> {
    const results: BangumiUserCollection[] = [];
    let offset = 0;
    const limit = 50;
    while (true) {
        const url = `${BGM_BASE}/v0/users/${username}/collections?subject_type=${subject_type}&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: makeHeaders(token) });
        if (!res.ok) throw new Error(`获取 Bangumi 收藏失败 (${res.status})`);
        const data = await res.json() as { data: BangumiUserCollection[]; total: number; offset: number; limit: number };
        const items = data.data ?? [];
        results.push(...items);
        if (results.length >= data.total || items.length < limit) break;
        offset += limit;
    }
    return results;
}

/** POST /v0/search/subjects — search anime by name.
 *  Throws on API errors (auth, network). Returns [] only for genuine empty results. */
export async function bangumiSearchSubject(
    name: string,
    token?: string,
): Promise<BangumiSearchResult[]> {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'User-Agent': 'GridTrax/1.0 (https://github.com/your/repo)',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BGM_BASE}/v0/search/subjects?limit=5`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ keyword: name, filter: { type: [2] } }),
    });
    if (!res.ok) {
        throw new Error(`Bangumi 搜索失败 (${res.status} ${res.statusText})`);
    }
    const data = await res.json() as { data: BangumiSearchResult[] };
    return data.data ?? [];
}

/** PATCH /v0/users/-/collections/{subject_id} — update existing collection entry */
export async function bangumiPatchCollection(
    token: string,
    subject_id: number,
    payload: { type?: BangumiCollectionType; rate?: number; comment?: string },
): Promise<void> {
    const res = await fetch(`${BGM_BASE}/v0/users/-/collections/${subject_id}`, {
        method: 'PATCH',
        headers: makeHeaders(token),
        body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 204) {
        throw new Error(`同步到 Bangumi 失败 (${res.status})`);
    }
}

/** POST /v0/users/-/collections/{subject_id} — create or update (upsert) a collection entry.
 *  Unlike PATCH, this will create the entry if it does not exist. */
export async function bangumiPostCollection(
    token: string,
    subject_id: number,
    payload: { type?: BangumiCollectionType; rate?: number; comment?: string },
): Promise<void> {
    const res = await fetch(`${BGM_BASE}/v0/users/-/collections/${subject_id}`, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 204) {
        throw new Error(`新建 Bangumi 收藏失败 (${res.status})`);
    }
}

/**
 * GET /v0/users/-/collections/{subject_id}
 * Returns the user's current collection entry for this subject, or null if not collected.
 */
export async function bangumiGetSubjectCollection(
    token: string,
    subject_id: number,
): Promise<{ type: BangumiCollectionType; rate: number } | null> {
    const res = await fetch(`${BGM_BASE}/v0/users/-/collections/${subject_id}`, {
        headers: makeHeaders(token),
    });
    if (res.status === 404 || res.status === 401 || res.status === 400) return null;
    if (!res.ok) return null; // Treat errors as "not found" to avoid blocking the user
    const data = await res.json() as { type: BangumiCollectionType; rate: number };
    return data;
}

/** PATCH /v0/users/-/collections/{subject_id}/episodes — set episode watch states */
export async function bangumiPutEpisodes(
    token: string,
    subject_id: number,
    episode_ids: number[],
    type: 0 | 2, // 0=未看, 2=看过
): Promise<void> {
    const res = await fetch(`${BGM_BASE}/v0/users/-/collections/${subject_id}/episodes`, {
        method: 'PATCH',
        headers: makeHeaders(token),
        body: JSON.stringify({ episode_id: episode_ids, type }),
    });
    if (!res.ok && res.status !== 204) {
        throw new Error(`同步集数到 Bangumi 失败 (${res.status})`);
    }
}

/** GET /v0/episodes — get episodes of a subject to resolve episode IDs */
export async function bangumiGetEpisodes(
    subject_id: number,
): Promise<{ id: number; sort: number; ep: number; type: number }[]> {
    const res = await fetch(`${BGM_BASE}/v0/episodes?subject_id=${subject_id}&type=0&limit=200`, {
        headers: { 'User-Agent': 'GridTrax/1.0 (https://github.com/your/repo)' },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data: { id: number; sort: number; ep: number; type: number }[] };
    return data.data ?? [];
}

/**
 * GET /v0/users/-/collections/{subject_id}/episodes
 * Returns user's episode watch states for a subject.
 * episode.type: 0=未收藏, 1=想看, 2=看过, 3=抛弃
 */
export async function bangumiGetUserEpisodes(
    token: string,
    subject_id: number,
): Promise<{ episode: { id: number; sort: number; type: number }; type: number }[]> {
    const results: { episode: { id: number; sort: number; type: number }; type: number }[] = [];
    let offset = 0;
    const limit = 100;
    while (true) {
        const res = await fetch(
            `${BGM_BASE}/v0/users/-/collections/${subject_id}/episodes?episode_type=0&limit=${limit}&offset=${offset}`,
            { headers: makeHeaders(token) }
        );
        if (!res.ok) break;
        const data = await res.json() as {
            data: { episode: { id: number; sort: number; type: number }; type: number }[];
            total: number;
        };
        const items = data.data ?? [];
        results.push(...items);
        if (results.length >= data.total || items.length < limit) break;
        offset += limit;
    }
    return results;
}
