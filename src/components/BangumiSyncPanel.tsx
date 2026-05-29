import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SaveIcon from '@mui/icons-material/Save';
import SyncIcon from '@mui/icons-material/Sync';
/* eslint-disable react-refresh/only-export-components */
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';
import {
    BANGUMI_TO_GRIDTRAX,
    GRIDTRAX_TO_BANGUMI,
    bangumiGetCollections,
    bangumiGetEpisodes,
    bangumiGetMe,
    bangumiGetSubjectCollection,
    bangumiGetUserEpisodes,
    bangumiPostCollection,
    bangumiPutEpisodes,
    bangumiSearchSubject,
    type BangumiCollectionType
} from '../api/bangumiService';
import { searchTV } from '../api/tmdb';
import { useBangumiStore } from '../store/useBangumiStore';
import { useProgressStore } from '../store/useProgressStore';
import type { SeasonRecord } from '../types';

// ── Bangumi SVG Icon (themed to primary color) ────────────────────────────────

const BangumiIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill={color}>
        <path d="M228.115268 615.399298a12.300795 12.300795 0 0 0 11.35458 7.569719 12.471113 12.471113 0 0 0 4.749999-0.965139l147.609537-61.882459a12.300795 12.300795 0 0 0 0.26494-22.557765l-147.609537-66.235049a12.300795 12.300795 0 1 0-10.067727 22.444219l121.740019 54.634453-121.456155 50.906366a12.300795 12.300795 0 0 0-6.585656 16.085655zM399.020617 627.965033H239.469848a12.300795 12.300795 0 0 0 0 24.601589h159.550769a12.300795 12.300795 0 0 0 0-24.601589zM399.020617 667.460046H239.469848a12.300795 12.300795 0 0 0 0 24.601589h159.550769a12.300795 12.300795 0 0 0 0-24.601589zM872.941851 476.892349l-133.283841 58.381464a12.300795 12.300795 0 0 0-0.397411 22.349598l133.302766 64.058754a12.073703 12.073703 0 0 0 5.317729 1.23008 12.300795 12.300795 0 0 0 5.336652-23.390435l-109.15536-52.42031L882.896033 499.469038a12.300795 12.300795 0 1 0-9.954182-22.576689zM877.881094 627.965033h-148.101569a12.300795 12.300795 0 0 0 0 24.601589h148.101569a12.300795 12.300795 0 0 0 0-24.601589zM877.881094 667.460046h-148.101569a12.300795 12.300795 0 0 0 0 24.601589h148.101569a12.300795 12.300795 0 0 0 0-24.601589zM644.866193 537.128395h-162.919295a12.28187 12.28187 0 0 0-10.711153 18.318722l81.374488 145.130453a12.300795 12.300795 0 0 0 21.460155 0l81.374489-145.130453a12.300795 12.300795 0 0 0-10.730078-18.318722z m-81.374488 132.299778l-60.444213-107.698189h120.888426z" />
        <path d="M891.411968 334.960102H648.405037c-6.812748-15.13944-19.813742-28.386449-36.864535-38.018917L803.092262 19.283861a12.300795 12.300795 0 0 0-20.249001-13.966133L588.566402 286.873457a147.723082 147.723082 0 0 0-45.418319-7.001991 151.507942 151.507942 0 0 0-31.887445 3.368526L239.980804 4.712151A12.300795 12.300795 0 0 0 222.437978 21.87649l262.726051 269.803739c-22.14143 9.821711-39.116527 25.112546-47.310749 43.242025H132.547555A91.763929 91.763929 0 0 0 40.764702 426.705107v414.44216A91.763929 91.763929 0 0 0 132.547555 932.967969h268.024855l-19.908363 46.989036c-12.641432 29.881469 22.614538 57.094612 48.294812 37.299794L538.473781 932.967969h352.938187a91.763929 91.763929 0 0 0 91.782853-91.782853v-414.442161a91.763929 91.763929 0 0 0-91.782853-91.782853z m34.839635 463.815658a60.709153 60.709153 0 0 1-60.709153 60.709153H585.670984L487.870204 932.967969l-77.002975 57.851583 24.412346-57.851583 31.016927-73.483056H198.082405A60.728077 60.728077 0 0 1 137.27863 798.737912V440.330602a60.728077 60.728077 0 0 1 60.728077-60.728077h667.460046a60.709153 60.709153 0 0 1 60.709153 60.728077z" />
    </svg>
);

// ── Log item ─────────────────────────────────────────────────────────────────

interface LogEntry {
    name: string;
    success: boolean;
    detail: string;
}

// ── Episode conflict dialog ──────────────────────────────────────────────────

interface EpisodeConflictItem {
    key: string;
    showName: string;
    localWatched: number[];
    remoteWatched: number[];
    tmdbId: number;
    seasonNumber: number;
    bangumiSubjectId: number;
}

const EpisodeConflictDialog: React.FC<{
    conflicts: EpisodeConflictItem[];
    open: boolean;
    onResolve: (pref: 'local' | 'remote') => void;
}> = ({ conflicts, open, onResolve }) => (
    <Dialog open={open} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>集数同步冲突</DialogTitle>
        <DialogContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                以下 {conflicts.length} 个条目的集数进度在 GridTrax 和 Bangumi 之间不一致，请选择以哪一方为准：
            </Typography>
            <Box sx={{ mt: 1, maxHeight: 260, overflow: 'auto' }}>
                {conflicts.slice(0, 15).map((c) => (
                    <Box key={c.key} sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" fontWeight={600}>{c.showName}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                            <Typography variant="caption" color="primary">
                                GridTrax: 已看 {c.localWatched.length} 集
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Bangumi: 已看 {c.remoteWatched.length} 集
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => onResolve('local')} variant="outlined" sx={{ borderRadius: 2 }}>以 GridTrax 为准 → 写入 Bangumi</Button>
            <Button onClick={() => onResolve('remote')} variant="contained" sx={{ borderRadius: 2 }}>以 Bangumi 为准 → 写入 GridTrax</Button>
        </DialogActions>
    </Dialog>
);


// ── Status conflict dialog ────────────────────────────────────────────────

interface ConflictItem { key: string; localStatus: string; remoteStatus: string }

const ConflictDialog: React.FC<{
    conflicts: ConflictItem[];
    open: boolean;
    onResolve: (pref: 'local' | 'remote') => void;
}> = ({ conflicts, open, onResolve }) => (
    <Dialog open={open} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>同步冲突</DialogTitle>
        <DialogContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                以下 {conflicts.length} 个条目在 GridTrax 和 Bangumi 之间状态不同，请选择以哪一方为准：
            </Typography>
            <Box sx={{ mt: 1, maxHeight: 220, overflow: 'auto' }}>
                {conflicts.slice(0, 15).map((c) => (
                    <Box key={c.key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" noWrap sx={{ maxWidth: '55%' }}>{c.key}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            本地: {c.localStatus} → Bangumi: {c.remoteStatus}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
            <Button onClick={() => onResolve('local')} variant="outlined" sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' }, m: { xs: '0 !important', sm: undefined } }}>保留 GridTrax 数据</Button>
            <Button onClick={() => onResolve('remote')} variant="contained" sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' }, m: { xs: '0 !important', sm: undefined } }}>以 Bangumi 为准</Button>
        </DialogActions>
    </Dialog>
);

// ── Main BangumiSyncPanel ─────────────────────────────────────────────────────

const BangumiSyncPanel: React.FC = () => {
    const theme = useTheme();
    const primary = theme.palette.primary.main;
    const { token, username, nickname, setToken, setUserInfo, autoSyncEnabled, setAutoSyncEnabled } = useBangumiStore();

    const [open, setOpen] = useState(false);
    const [formToken, setFormToken] = useState(token);
    const [showToken, setShowToken] = useState(false);

    type Status = 'idle' | 'loading' | 'success' | 'error';
    const [authStatus, setAuthStatus] = useState<{ type: Status; msg: string }>({ type: 'idle', msg: '' });
    const [syncRunning, setSyncRunning] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    // Progress
    const [importProgress, setImportProgress] = useState<{ current: number; total: number; name: string } | null>(null);

    // Detailed log
    const [log, setLog] = useState<LogEntry[]>([]);
    const [summary, setSummary] = useState<{ matched: number; skipped: number; total: number } | null>(null);

    // Conflict resolution — status
    const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
    const [conflictOpen, setConflictOpen] = useState(false);
    const [resolver, setResolver] = useState<null | ((pref: 'local' | 'remote') => void)>(null);

    // Conflict resolution — episodes
    const [epConflicts, setEpConflicts] = useState<EpisodeConflictItem[]>([]);
    const [epConflictOpen, setEpConflictOpen] = useState(false);
    const [epResolver, setEpResolver] = useState<null | ((pref: 'local' | 'remote') => void)>(null);

    const isConfigured = !!(token && username);

    const addLog = (entry: LogEntry) => setLog((prev) => [entry, ...prev]);

    // ── Verify token ──────────────────────────────────────────────────────────
    const handleVerify = async () => {
        if (!formToken.trim()) return;
        setAuthStatus({ type: 'loading', msg: '正在验证…' });
        try {
            const me = await bangumiGetMe(formToken.trim());
            setToken(formToken.trim());
            setUserInfo({ username: me.username, userId: me.id, nickname: me.nickname });
            setAuthStatus({ type: 'success', msg: `已登录为 ${me.nickname} (@${me.username})` });
        } catch (e) {
            setAuthStatus({ type: 'error', msg: (e as Error).message });
        }
    };

    // ── Import from Bangumi ───────────────────────────────────────────────────
    const handleImport = async () => {
        if (!isConfigured) return;
        setSyncRunning(true);
        setSyncMessage('正在拉取 Bangumi 收藏列表…');
        setLog([]);
        setSummary(null);
        setImportProgress(null);
        try {
            const collections = await bangumiGetCollections(token, username, 2);
            const total = collections.length;
            const store = useProgressStore.getState();
            let matched = 0, skipped = 0;

            setSyncMessage(`已拉取 ${total} 条，开始逐条匹配 TMDB…`);

            for (let i = 0; i < collections.length; i++) {
                const col = collections[i];
                const nameCn = col.subject?.name_cn || '';
                const nameOrig = col.subject?.name || '';
                const displayName = nameCn || nameOrig || `Subject #${col.subject_id}`;

                setImportProgress({ current: i + 1, total, name: displayName });

                // Check cache
                const cachedKey = Object.keys(store.data.records).find(
                    (k) => (store.data.records[k] as SeasonRecord).bangumi_subject_id === col.subject_id
                );
                if (cachedKey) {
                    const rec = store.data.records[cachedKey] as SeasonRecord;
                    store.setSeasonStatus(rec.tmdb_id, rec.season_number, BANGUMI_TO_GRIDTRAX[col.type]);
                    if (col.rate > 0) store.setSeasonRating(rec.tmdb_id, rec.season_number, col.rate);

                    // Also import episode progress for cached items
                    try {
                        const userEps = await bangumiGetUserEpisodes(token, col.subject_id);
                        const watchedSorts = new Set<number>(
                            userEps
                                .filter((e: { type: number }) => e.type === 2)
                                .map((e: { episode: { sort: number } }) => Math.round(e.episode.sort))
                        );
                        if (watchedSorts.size > 0) {
                            const curStore = useProgressStore.getState();
                            const epCount = col.ep_status || watchedSorts.size;
                            for (const ep of watchedSorts) {
                                const existing = rec.episodes?.[String(ep)];
                                if (!existing?.watched) {
                                    curStore.toggleEpisodeWatched(rec.tmdb_id, rec.season_number, ep, {
                                        show_name: rec.show_name,
                                        episode_count: epCount,
                                    });
                                }
                            }
                            addLog({ name: displayName, success: true, detail: `已缓存 → ${BANGUMI_TO_GRIDTRAX[col.type]} · 已看 ${watchedSorts.size} 集` });
                        } else {
                            addLog({ name: displayName, success: true, detail: `已缓存 → ${BANGUMI_TO_GRIDTRAX[col.type]}` });
                        }
                    } catch {
                        addLog({ name: displayName, success: true, detail: `已缓存 → ${BANGUMI_TO_GRIDTRAX[col.type]}` });
                    }
                    matched++;
                    continue;
                }

                // Search TMDB
                let tmdbMatch: { id: number; name: string; poster_path?: string } | null = null;
                for (const q of [nameCn, nameOrig].filter(Boolean)) {
                    tmdbMatch = await searchTV(q);
                    if (tmdbMatch) break;
                }

                if (!tmdbMatch) {
                    addLog({ name: displayName, success: false, detail: '未在 TMDB 找到匹配条目' });
                    skipped++;
                    await new Promise((r) => setTimeout(r, 150));
                    continue;
                }

                const tmdbId = tmdbMatch.id;
                const gridtraxStatus = BANGUMI_TO_GRIDTRAX[col.type];
                store.setSeasonStatus(tmdbId, 1, gridtraxStatus, {
                    show_name: tmdbMatch.name,
                    name: '第 1 季',
                    poster_path: tmdbMatch.poster_path,
                });
                if (col.rate > 0) store.setSeasonRating(tmdbId, 1, col.rate);

                // Cache bangumi_subject_id and bangumi_scanned
                const recKey = `tmdb_tv_${tmdbId}_s1`;
                useProgressStore.setState((s) => ({
                    data: {
                        ...s.data,
                        records: {
                            ...s.data.records,
                            [recKey]: {
                                ...s.data.records[recKey],
                                bangumi_subject_id: col.subject_id,
                                bangumi_scanned: true,
                            } as SeasonRecord,
                        },
                    },
                }));

                // ── Import episode progress from Bangumi ───────────────────────
                try {
                    const userEps = await bangumiGetUserEpisodes(token, col.subject_id);
                    const watchedSorts = new Set<number>(
                        userEps
                            .filter((e: { type: number }) => e.type === 2) // type 2 = 看过
                            .map((e: { episode: { sort: number } }) => Math.round(e.episode.sort))
                    );

                    if (watchedSorts.size > 0) {
                        const currentStore = useProgressStore.getState();
                        const episodeCount = col.ep_status || watchedSorts.size;
                        const maxSorted = Math.max(...Array.from(watchedSorts));
                        const recKey2 = `tmdb_tv_${tmdbId}_s1`;
                        for (let ep = 1; ep <= maxSorted; ep++) {
                            if (watchedSorts.has(ep)) {
                                // Only toggle if not already watched (avoid double-toggle on re-import)
                                const existing = (currentStore.data.records[recKey2] as SeasonRecord | undefined)?.episodes?.[String(ep)];
                                if (!existing?.watched) {
                                    currentStore.toggleEpisodeWatched(tmdbId, 1, ep, {
                                        show_name: tmdbMatch.name,
                                        episode_count: episodeCount,
                                    });
                                }
                            }
                        }
                        addLog({ name: displayName, success: true, detail: `→ ${tmdbMatch.name} [TMDB ${tmdbId}] · ${gridtraxStatus} · 已看 ${watchedSorts.size} 集` });
                    } else {
                        addLog({ name: displayName, success: true, detail: `→ ${tmdbMatch.name} [TMDB ${tmdbId}] · ${gridtraxStatus}` });
                    }
                } catch {
                    addLog({ name: displayName, success: true, detail: `→ ${tmdbMatch.name} [TMDB ${tmdbId}] · ${gridtraxStatus} (集数导入失败)` });
                }
                matched++;
                await new Promise((r) => setTimeout(r, 250));
            }

            setImportProgress(null);
            setSummary({ matched, skipped, total });
            setSyncMessage('');
        } catch (e) {
            setSyncMessage(`导入出错：${(e as Error).message}`);
            setImportProgress(null);
        } finally {
            setSyncRunning(false);
        }
    };

    // ── Incremental sync ──────────────────────────────────────────────────────
    const handleIncrementalSync = async () => {
        if (!isConfigured) return;
        setSyncRunning(true);
        setSyncMessage('正在拉取 Bangumi 收藏…');
        setLog([]);
        setSummary(null);
        setImportProgress(null);
        try {
            const collections = await bangumiGetCollections(token, username, 2);
            const bgmMap = new Map(collections.map((c) => [c.subject_id, c]));
            const store = useProgressStore.getState();
            const detectedConflicts: ConflictItem[] = [];
            let newPushed = 0;
            let skipped = 0;

            // ── Diagnostics ──────────────────────────────────────────────────
            const allEntries = Object.entries(store.data.records);
            const tvSeasons = allEntries.filter(([, r]) => r.type === 'tv_season');
            const withSubjectId = tvSeasons.filter(([, r]) => (r as SeasonRecord).bangumi_subject_id);
            const withScanned = tvSeasons.filter(([, r]) => (r as SeasonRecord).bangumi_scanned);
            const withStatus = tvSeasons.filter(([, r]) => (r as SeasonRecord).global_status);
            const candidatesBeforeReset = tvSeasons.filter(([, r]) => {
                const sr = r as SeasonRecord;
                return !sr.bangumi_subject_id && !sr.bangumi_scanned && sr.global_status;
            });
            addLog({ name: '🔍 诊断', success: true, detail: `总记录 ${allEntries.length} · TV ${tvSeasons.length} · 有subject_id ${withSubjectId.length} · 已扫描 ${withScanned.length} · 有状态 ${withStatus.length} · 候选(重置前) ${candidatesBeforeReset.length}` });

            // ── Pass 0: Reset false positives from previous buggy scans ────
            const allRecords = { ...store.data.records };
            let resetCount = 0;
            for (const [key, rec] of Object.entries(allRecords)) {
                if (rec.type === 'tv_season') {
                    const sr = rec as SeasonRecord;
                    if (sr.bangumi_scanned && !sr.bangumi_subject_id) {
                        allRecords[key] = { ...sr, bangumi_scanned: false };
                        resetCount++;
                    }
                }
            }
            if (resetCount > 0) {
                useProgressStore.setState((s) => ({
                    data: { ...s.data, records: allRecords },
                }));
                addLog({ name: '🔄 重置', success: true, detail: `已重置 ${resetCount} 条误标记条目` });
            }

            // ── Pass 1: Link & push unlinked records ─────────────────────────
            const storeAfterReset = useProgressStore.getState();
            setSyncMessage('正在处理本地新增条目…');
            const unlinked = Object.entries(storeAfterReset.data.records).filter(
                ([, rec]) => rec.type === 'tv_season'
                    && !(rec as SeasonRecord).bangumi_subject_id
                    && !(rec as SeasonRecord).bangumi_scanned
                    && (rec as SeasonRecord).global_status
            );
            addLog({ name: '📋 Pass 1', success: true, detail: `找到 ${unlinked.length} 条待搜索的本地新增条目` });

            // Log the names of unlinked items for debugging
            if (unlinked.length > 0) {
                const names = unlinked.slice(0, 5).map(([, r]) => (r as SeasonRecord).show_name || (r as SeasonRecord).name || '?').join(', ');
                addLog({ name: '📋 待搜索', success: true, detail: names + (unlinked.length > 5 ? ` …+${unlinked.length - 5}` : '') });
            }

            setImportProgress(unlinked.length > 0 ? { current: 0, total: unlinked.length, name: '' } : null);

            for (let i = 0; i < unlinked.length; i++) {
                const [recKey, rec] = unlinked[i];
                const sr = rec as SeasonRecord;
                const displayName = sr.show_name || sr.name || `TV ${sr.tmdb_id}`;
                setImportProgress({ current: i + 1, total: unlinked.length, name: displayName });

                // Search Bangumi for this show
                let results: Awaited<ReturnType<typeof bangumiSearchSubject>>;
                try {
                    results = await bangumiSearchSubject(displayName, token);
                } catch (err) {
                    addLog({ name: displayName, success: false, detail: `搜索 API 出错：${(err as Error).message}` });
                    skipped++;
                    continue;
                }

                addLog({ name: displayName, success: true, detail: `搜索返回 ${results.length} 条结果` });

                const match = results[0];
                if (!match) {
                    useProgressStore.setState((s) => ({
                        data: {
                            ...s.data,
                            records: {
                                ...s.data.records,
                                [recKey]: { ...s.data.records[recKey], bangumi_scanned: true },
                            },
                        },
                    }));
                    addLog({ name: displayName, success: false, detail: '未在 Bangumi 找到匹配，已标记跳过' });
                    skipped++;
                    await new Promise((r) => setTimeout(r, 200));
                    continue;
                }

                // Cache the subject_id and mark as scanned
                useProgressStore.setState((s) => ({
                    data: {
                        ...s.data,
                        records: {
                            ...s.data.records,
                            [recKey]: { ...s.data.records[recKey], bangumi_subject_id: match.id, bangumi_scanned: true },
                        },
                    },
                }));

                // Check if subject already exists in user's Bangumi collection
                const existingBgm = await bangumiGetSubjectCollection(token, match.id);

                if (existingBgm) {
                    // Already in Bangumi collection — do NOT overwrite; let Pass 2 detect conflict
                    addLog({ name: displayName, success: true, detail: `🔗 已关联「${match.name_cn || match.name}」(Bangumi 已有记录，交由增量同步处理)` });
                    // Add real Bangumi status to bgmMap so Pass 2 can compare correctly
                    bgmMap.set(match.id, {
                        subject_id: match.id,
                        subject_type: 2,
                        rate: existingBgm.rate,
                        type: existingBgm.type,
                        comment: null,
                        ep_status: 0,
                        vol_status: 0,
                        updated_at: new Date().toISOString(),
                        subject: { id: match.id, name: match.name, name_cn: match.name_cn, type: 2 },
                    });
                } else if (sr.global_status) {
                    // Not yet in Bangumi — safe to push
                    try {
                        await bangumiPostCollection(token, match.id, {
                            type: GRIDTRAX_TO_BANGUMI[sr.global_status],
                            rate: sr.rating || 0,
                        });
                        addLog({ name: displayName, success: true, detail: `✅ 已在 Bangumi 新建「${match.name_cn || match.name}」· ${sr.global_status}` });
                        newPushed++;
                        // Add to bgmMap reflecting the status we just pushed
                        bgmMap.set(match.id, {
                            subject_id: match.id,
                            subject_type: 2,
                            rate: sr.rating || 0,
                            type: GRIDTRAX_TO_BANGUMI[sr.global_status],
                            comment: null,
                            ep_status: 0,
                            vol_status: 0,
                            updated_at: new Date().toISOString(),
                            subject: { id: match.id, name: match.name, name_cn: match.name_cn, type: 2 },
                        });
                    } catch (err) {
                        addLog({ name: displayName, success: false, detail: `推送失败：${(err as Error).message}` });
                    }
                }

                await new Promise((r) => setTimeout(r, 250));
            }

            setImportProgress(null);

            // ── Pass 2: Existing linked records — conflict detection ──────────
            // Refresh store state after caching subject IDs in Pass 1
            const refreshed = useProgressStore.getState();
            for (const [key, rec] of Object.entries(refreshed.data.records)) {
                if (rec.type !== 'tv_season') continue;
                const sr = rec as SeasonRecord;
                if (!sr.bangumi_subject_id) continue;
                const bgm = bgmMap.get(sr.bangumi_subject_id);
                if (!bgm) continue;
                const bgmStatus = BANGUMI_TO_GRIDTRAX[bgm.type];
                if (sr.global_status && bgmStatus && sr.global_status !== bgmStatus) {
                    detectedConflicts.push({ key: sr.show_name || key, localStatus: sr.global_status, remoteStatus: bgmStatus });
                }
            }

            if (detectedConflicts.length > 0) {
                setConflicts(detectedConflicts);
                setSyncMessage('');
                const pref = await new Promise<'local' | 'remote'>((resolve) => {
                    setResolver(() => resolve);
                    setConflictOpen(true);
                });
                setConflictOpen(false);
                setResolver(null);

                let synced = 0;
                for (const rec of Object.values(refreshed.data.records)) {
                    if (rec.type !== 'tv_season') continue;
                    const sr = rec as SeasonRecord;
                    if (!sr.bangumi_subject_id) continue;
                    const bgm = bgmMap.get(sr.bangumi_subject_id);
                    if (!bgm) continue;
                    if (pref === 'remote') {
                        refreshed.setSeasonStatus(sr.tmdb_id, sr.season_number, BANGUMI_TO_GRIDTRAX[bgm.type]);
                        if (bgm.rate > 0) refreshed.setSeasonRating(sr.tmdb_id, sr.season_number, bgm.rate);
                        addLog({ name: sr.show_name || `TV ${sr.tmdb_id}`, success: true, detail: `Bangumi→ ${BANGUMI_TO_GRIDTRAX[bgm.type]}` });
                    } else {
                        if (sr.global_status) {
                            await bangumiPostCollection(token, sr.bangumi_subject_id, { type: GRIDTRAX_TO_BANGUMI[sr.global_status], rate: sr.rating });
                            addLog({ name: sr.show_name || `TV ${sr.tmdb_id}`, success: true, detail: `GridTrax→ Bangumi · ${sr.global_status}` });
                        }
                    }
                    synced++;
                }
                setSummary({ matched: newPushed + synced, skipped, total: unlinked.length + synced });
            } else {
                setSyncMessage('无冲突，推送本地进度到 Bangumi…');
                let synced = 0;

                // ── Detect episode conflicts first ─────────────────────────────
                const detectedEpConflicts: EpisodeConflictItem[] = [];
                const epDataMap = new Map<number, {
                    localWatched: number[];
                    remoteWatched: number[];
                    epIds: Record<string, number>;
                }>();

                for (const rec of Object.values(refreshed.data.records)) {
                    if (rec.type !== 'tv_season') continue;
                    const sr = rec as SeasonRecord;
                    if (!sr.bangumi_subject_id || !sr.global_status) continue;
                    const alreadyPushedInPass1 = bgmMap.has(sr.bangumi_subject_id) &&
                        newPushed > 0 &&
                        unlinked.some(([, r]) => (r as SeasonRecord).tmdb_id === sr.tmdb_id);
                    if (alreadyPushedInPass1) continue;

                    // Push collection status
                    await bangumiPostCollection(token, sr.bangumi_subject_id, {
                        type: GRIDTRAX_TO_BANGUMI[sr.global_status],
                        rate: sr.rating,
                    });
                    synced++;

                    const localWatched = Object.entries(sr.episodes)
                        .filter(([, ep]) => ep.watched)
                        .map(([num]) => Number(num))
                        .sort((a, b) => a - b);

                    {  // always check remote episode progress alongside local
                        try {
                            let epIds = sr.bangumi_episode_ids;
                            if (!epIds) {
                                const epList = await bangumiGetEpisodes(sr.bangumi_subject_id);
                                epIds = Object.fromEntries(
                                    epList.map((ep: { sort: number; id: number }) => [String(Math.round(ep.sort)), ep.id])
                                );
                                // Bug 7 fix: persist the episode ID cache so future syncs skip this fetch
                                const recKeyForCache = `tmdb_tv_${sr.tmdb_id}_s${sr.season_number}`;
                                useProgressStore.setState((s) => ({
                                    data: {
                                        ...s.data,
                                        records: {
                                            ...s.data.records,
                                            [recKeyForCache]: {
                                                ...s.data.records[recKeyForCache],
                                                bangumi_episode_ids: epIds,
                                            },
                                        },
                                    },
                                }));
                            }
                            const remoteEps = await bangumiGetUserEpisodes(token, sr.bangumi_subject_id);
                            const remoteWatched = remoteEps
                                .filter((e) => e.type === 2)
                                .map((e) => Math.round(e.episode.sort))
                                .sort((a, b) => a - b);

                            const localSet = new Set(localWatched);
                            const remoteSet = new Set(remoteWatched);
                            const hasConflict = localWatched.length !== remoteWatched.length ||
                                localWatched.some((n) => !remoteSet.has(n)) ||
                                remoteWatched.some((n) => !localSet.has(n));

                            if (hasConflict && (localWatched.length > 0 || remoteWatched.length > 0)) {
                                detectedEpConflicts.push({
                                    key: `${sr.tmdb_id}_${sr.season_number}`,
                                    showName: sr.show_name || `TV ${sr.tmdb_id}`,
                                    localWatched,
                                    remoteWatched,
                                    tmdbId: sr.tmdb_id,
                                    seasonNumber: sr.season_number,
                                    bangumiSubjectId: sr.bangumi_subject_id,
                                });
                            }
                            epDataMap.set(sr.bangumi_subject_id, { localWatched, remoteWatched, epIds });
                        } catch {
                            // Skip per-show episode check errors
                        }
                    }
                }

                // ── Resolve episode conflicts ──────────────────────────────────
                let epPref: 'local' | 'remote' = 'local';
                if (detectedEpConflicts.length > 0) {
                    setEpConflicts(detectedEpConflicts);
                    setSyncMessage('');
                    epPref = await new Promise<'local' | 'remote'>((resolve) => {
                        setEpResolver(() => resolve);
                        setEpConflictOpen(true);
                    });
                    setEpConflictOpen(false);
                    setEpResolver(null);
                }

                // ── Apply resolutions ──────────────────────────────────────────
                for (const conflict of detectedEpConflicts) {
                    const epData = epDataMap.get(conflict.bangumiSubjectId);
                    if (!epData) continue;

                    if (epPref === 'local') {
                        // GridTrax → Bangumi
                        const bgmEpIds = conflict.localWatched
                            .map((n) => epData.epIds[String(n)])
                            .filter(Boolean) as number[];
                        if (bgmEpIds.length > 0) {
                            try { await bangumiPutEpisodes(token, conflict.bangumiSubjectId, bgmEpIds, 2); } catch { /* ignore */ }
                        }
                        addLog({ name: conflict.showName, success: true, detail: `集数 GridTrax→Bangumi · ${bgmEpIds.length} 集` });
                    } else {
                        // Bangumi → GridTrax: explicitly set watched state rather than blindly toggling
                        const currentStore = useProgressStore.getState();
                        const remoteSet = new Set(conflict.remoteWatched);
                        const localSet = new Set(conflict.localWatched);
                        const recKey = `tmdb_tv_${conflict.tmdbId}_s${conflict.seasonNumber}`;
                        // Mark remote-watched episodes that aren't locally watched yet
                        for (const ep of conflict.remoteWatched) {
                            if (!localSet.has(ep)) {
                                const existing = (currentStore.data.records[recKey] as SeasonRecord | undefined)?.episodes?.[String(ep)];
                                if (!existing?.watched) {
                                    currentStore.toggleEpisodeWatched(conflict.tmdbId, conflict.seasonNumber, ep);
                                }
                            }
                        }
                        // Unmark local-watched episodes that aren't in remote
                        for (const ep of conflict.localWatched) {
                            if (!remoteSet.has(ep)) {
                                const existing = (currentStore.data.records[recKey] as SeasonRecord | undefined)?.episodes?.[String(ep)];
                                if (existing?.watched) {
                                    currentStore.toggleEpisodeWatched(conflict.tmdbId, conflict.seasonNumber, ep);
                                }
                            }
                        }
                        addLog({ name: conflict.showName, success: true, detail: `集数 Bangumi→GridTrax · ${conflict.remoteWatched.length} 集` });
                    }
                }

                // ── Push non-conflicting episode progress ──────────────────────
                for (const [subjectId, epData] of epDataMap.entries()) {
                    const isConflicted = detectedEpConflicts.some((c) => c.bangumiSubjectId === subjectId);
                    if (isConflicted) continue;
                    if (epData.localWatched.length === 0) continue;
                    const bgmEpIds = epData.localWatched
                        .map((n) => epData.epIds[String(n)])
                        .filter(Boolean) as number[];
                    if (bgmEpIds.length > 0) {
                        try { await bangumiPutEpisodes(token, subjectId, bgmEpIds, 2); } catch { /* ignore */ }
                        // Find the show name for logging
                        const showName = Object.values(refreshed.data.records).find(
                            (r) => r.type === 'tv_season' && (r as SeasonRecord).bangumi_subject_id === subjectId
                        ) as SeasonRecord | undefined;
                        addLog({ name: showName?.show_name || `Subject ${subjectId}`, success: true, detail: `推送 ${bgmEpIds.length} 集` });
                    }
                }

                setSummary({ matched: newPushed + synced, skipped, total: unlinked.length + synced });
                setSyncMessage('');
            }
        } catch (e) {
            setSyncMessage(`同步出错：${(e as Error).message}`);
        } finally {
            setSyncRunning(false);
            setImportProgress(null);
        }
    };


    return (
        <>
            {/* Top-bar icon button */}
            <Tooltip title={isConfigured ? `Bangumi · ${nickname || username}` : 'Bangumi 同步'} placement="bottom" arrow>
                <IconButton
                    onClick={() => setOpen(true)}
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        color: isConfigured ? primary : 'text.secondary',
                        '&:hover': {
                            backgroundColor: alpha(primary, 0.08),
                            color: primary,
                        },
                    }}
                >
                    <BangumiIcon color="currentColor" size={24} />
                </IconButton>
            </Tooltip>

            {/* Dialog */}
            <Dialog
                open={open}
                onClose={() => !syncRunning && setOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3, backgroundImage: 'none' } }}
            >
                <DialogTitle sx={{ pb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 1.5, backgroundColor: alpha(primary, 0.12) }}>
                            <BangumiIcon color={primary} size={22} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>Bangumi 同步</Typography>
                            {isConfigured && (
                                <Typography variant="caption" color="text.secondary">{nickname} · @{username}</Typography>
                            )}
                        </Box>
                        {isConfigured && (
                            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                    icon={<AccountCircleIcon sx={{ fontSize: '14px !important' }} />}
                                    label="已连接"
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                />
                                <Tooltip title="断开连接并清除 Token" arrow>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                            if (window.confirm('确定要断开 Bangumi 连接并清除本地 Token 吗？')) {
                                                setToken('');
                                                setUserInfo({ username: '', userId: 0, nickname: '' });
                                                setFormToken('');
                                                setAuthStatus({ type: 'idle', msg: '' });
                                                setOpen(false);
                                            }
                                        }}
                                        sx={{
                                            border: 1,
                                            borderColor: alpha(theme.palette.error.main, 0.3),
                                            '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.1) },
                                        }}
                                    >
                                        <ExitToAppIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </Box>
                </DialogTitle>

                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {/* ── Token input ── */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1, fontSize: '0.65rem' }}>
                                Access Token
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                <TextField
                                    placeholder="在 next.bgm.tv/demo/access-token 获取"
                                    value={formToken}
                                    onChange={(e) => setFormToken(e.target.value)}
                                    size="small"
                                    type={showToken ? 'text' : 'password'}
                                    fullWidth
                                    slotProps={{
                                        inputLabel: { shrink: true },
                                        input: {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Button size="small" onClick={() => setShowToken(v => !v)}
                                                        sx={{ minWidth: 0, px: 1, fontSize: '0.7rem', color: 'text.secondary' }}>
                                                        {showToken ? '隐藏' : '显示'}
                                                    </Button>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />
                                <Tooltip title="验证并保存 Token" arrow>
                                    <IconButton
                                        color="primary"
                                        onClick={handleVerify}
                                        disabled={!formToken.trim() || authStatus.type === 'loading'}
                                        sx={{ border: 1, borderColor: 'divider', borderRadius: 2, height: 40, width: 40, '&:hover': { borderColor: 'primary.main' } }}
                                    >
                                        {authStatus.type === 'loading' ? <CircularProgress size={18} /> : <SaveIcon />}
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Collapse in={authStatus.type !== 'idle'} unmountOnExit>
                                <Box sx={{ mt: 1 }}>
                                    {authStatus.type === 'success' && (
                                        <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} sx={{ py: 0.3, borderRadius: 2, fontSize: '0.8rem' }}>
                                            {authStatus.msg}
                                        </Alert>
                                    )}
                                    {authStatus.type === 'error' && (
                                        <Alert severity="error" icon={<ErrorIcon fontSize="inherit" />} sx={{ py: 0.3, borderRadius: 2, fontSize: '0.8rem' }}>
                                            {authStatus.msg}
                                        </Alert>
                                    )}
                                </Box>
                            </Collapse>
                            {!isConfigured && (
                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                                    前往 <a href="https://next.bgm.tv/demo/access-token" target="_blank" rel="noopener noreferrer" style={{ color: primary }}>next.bgm.tv/demo/access-token</a> 创建
                                </Typography>
                            )}
                        </Box>

                        <Divider />

                        {/* ── Action buttons ── */}
                        {isConfigured && (
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Tooltip title="将 Bangumi 所有收藏导入 GridTrax（搜索 TMDB 匹配）" arrow>
                                    <span style={{ flex: 1 }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={syncRunning ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                                            onClick={handleImport}
                                            disabled={syncRunning}
                                            fullWidth
                                            sx={{ borderRadius: 2, textTransform: 'none' }}
                                        >
                                            从 Bangumi 导入
                                        </Button>
                                    </span>
                                </Tooltip>
                                <Tooltip title="双向增量同步（处理冲突后推送）" arrow>
                                    <span style={{ flex: 1 }}>
                                        <Button
                                            variant="contained"
                                            startIcon={syncRunning ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                                            onClick={handleIncrementalSync}
                                            disabled={syncRunning}
                                            fullWidth
                                            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                                        >
                                            增量同步
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Box>
                        )}

                        {/* ── Auto-sync toggle ── */}
                        {isConfigured && (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                                <Box>
                                    <Typography variant="body2" fontWeight={600}>状态更新后自动同步到 Bangumi</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        开启后，每次在 GridTrax 修改状态或进度时会立即推送至 Bangumi；关闭后仅通过「增量同步」按钮同步
                                    </Typography>
                                </Box>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={autoSyncEnabled}
                                            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                                            color="primary"
                                            size="small"
                                        />
                                    }
                                    label=""
                                    sx={{ ml: 1, mr: 0 }}
                                />
                            </Box>
                        )}

                        {/* ── Progress bar ── */}
                        {syncRunning && importProgress && (
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <CircularProgress size={13} />
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                                        {syncMessage || '正在匹配…'}&nbsp;·&nbsp;{importProgress.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                                        {importProgress.current}/{importProgress.total}
                                    </Typography>
                                </Box>
                                <Box sx={{ height: 4, borderRadius: 2, backgroundColor: alpha(primary, 0.15), overflow: 'hidden' }}>
                                    <Box sx={{
                                        height: '100%', borderRadius: 2, backgroundColor: primary,
                                        width: `${(importProgress.current / importProgress.total) * 100}%`,
                                        transition: 'width 0.3s ease',
                                    }} />
                                </Box>
                            </Box>
                        )}
                        {syncRunning && !importProgress && syncMessage && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={13} />
                                <Typography variant="caption" color="text.secondary">{syncMessage}</Typography>
                            </Box>
                        )}

                        {/* ── Summary ── */}
                        {summary && (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip label={`✓ 匹配 ${summary.matched} 条`} size="small" color="success" variant="outlined" />
                                {summary.skipped > 0 && <Chip label={`✗ 跳过 ${summary.skipped} 条（TMDB 无结果）`} size="small" color="warning" variant="outlined" />}
                                <Chip label={`共 ${summary.total} 条`} size="small" variant="outlined" />
                            </Box>
                        )}

                        {/* ── Detailed log ── */}
                        {log.length > 0 && (
                            <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1, fontSize: '0.65rem' }}>
                                    同步日志 (最新在上)
                                </Typography>
                                <Box sx={{
                                    mt: 0.5,
                                    maxHeight: 200,
                                    overflow: 'auto',
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(primary, 0.12)}`,
                                    backgroundColor: alpha(primary, 0.03),
                                }}>
                                    {log.map((entry, idx) => (
                                        <Box
                                            key={idx}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'baseline',
                                                gap: 0.75,
                                                px: 1.5,
                                                py: 0.4,
                                                borderBottom: idx < log.length - 1 ? `1px solid ${alpha(primary, 0.07)}` : 'none',
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{ color: entry.success ? 'success.main' : 'warning.main', fontWeight: 700, flexShrink: 0 }}
                                            >
                                                {entry.success ? '✓' : '✗'}
                                            </Typography>
                                            <Typography variant="caption" fontWeight={500} noWrap sx={{ maxWidth: '40%', flexShrink: 0 }}>
                                                {entry.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled" noWrap sx={{ flex: 1 }}>
                                                {entry.detail}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)} disabled={syncRunning} sx={{ borderRadius: 2 }}>关闭</Button>
                </DialogActions>
            </Dialog>

            <ConflictDialog
                conflicts={conflicts}
                open={conflictOpen}
                onResolve={(pref) => resolver?.(pref)}
            />
            <EpisodeConflictDialog
                conflicts={epConflicts}
                open={epConflictOpen}
                onResolve={(pref) => epResolver?.(pref)}
            />
        </>
    );
};

export default BangumiSyncPanel;

// ── Auto-push helpers ─────────────────────────────────────────────────────────

/** Silently push collection status + rating to Bangumi after a local change. */
export async function autoPushToBangumi(
    bangumi_subject_id: number | undefined,
    collectionType: BangumiCollectionType | undefined,
    rating: number,
): Promise<void> {
    const { token } = useBangumiStore.getState();
    if (!token || !bangumi_subject_id || !collectionType) return;
    try {
        await bangumiPostCollection(token, bangumi_subject_id, { type: collectionType, rate: rating });
    } catch {
        // Silently fail
    }
}

/**
 * When a new TV season is added/status-changed, silently search Bangumi for a matching entry.
 * - If found AND not yet in user's Bangumi collection: cache `bangumi_subject_id` and push current status.
 * - If found AND already in user's Bangumi collection: only cache `bangumi_subject_id`, do NOT push
 *   (user may have a different status on Bangumi — let incremental sync handle the conflict).
 * - If not found: mark `bangumi_scanned: true` so we never search again.
 * This is best-effort and totally non-blocking.
 */
export async function autoLinkAndPushToBangumi(
    tvId: number,
    seasonNumber: number,
    showName: string | undefined,
    status: import('../types').WatchStatus,
    rating: number,
): Promise<void> {
    const { token } = useBangumiStore.getState();
    if (!token || !showName) return;

    // Lazy import to avoid circular dep at module load time
    const { useProgressStore } = await import('../store/useProgressStore');
    const {
        bangumiSearchSubject,
        bangumiPostCollection: postCol,
        bangumiGetSubjectCollection: getExisting,
        GRIDTRAX_TO_BANGUMI: gtbMap,
    } = await import('../api/bangumiService');

    const recKey = `tmdb_tv_${tvId}_s${seasonNumber}`;

    // Check fresh state — might have been populated by a concurrent sync
    const rec = useProgressStore.getState().data.records[recKey];
    if (!rec || rec.type !== 'tv_season') return;
    const sr = rec as import('../types').SeasonRecord;
    if (sr.bangumi_subject_id || sr.bangumi_scanned) return; // Already linked or already searched

    try {
        const results = await bangumiSearchSubject(showName, token);
        const match = results[0];

        if (!match) {
            // Not on Bangumi at all — mark as scanned so we don't search again
            useProgressStore.setState((s) => ({
                data: {
                    ...s.data,
                    records: {
                        ...s.data.records,
                        [recKey]: { ...s.data.records[recKey], bangumi_scanned: true },
                    },
                },
            }));
            return;
        }

        // Cache the subject ID and mark scanned regardless of push outcome
        useProgressStore.setState((s) => ({
            data: {
                ...s.data,
                records: {
                    ...s.data.records,
                    [recKey]: {
                        ...s.data.records[recKey],
                        bangumi_subject_id: match.id,
                        bangumi_scanned: true,
                    },
                },
            },
        }));

        // Check if this subject is already in the user's Bangumi collection
        const existing = await getExisting(token, match.id);

        if (existing) {
            // Subject already collected on Bangumi — do NOT overwrite Bangumi's status.
            // The incremental sync will detect and resolve any conflict.
            return;
        }

        // Subject is new to Bangumi — safe to push GridTrax status
        await postCol(token, match.id, {
            type: gtbMap[status],
            rate: rating,
        });
    } catch {
        // Silently fail — never interrupt the user's local flow
    }
}

/**
 * Silently push a single episode's watched state to Bangumi after a local toggle.
 *
 * Strategy:
 *  1. Read the cached `bangumi_episode_ids` from SeasonRecord (sort → bgm_ep_id).
 *  2. If the cache is missing, fetch from `GET /v0/episodes?subject_id=...` and persist it.
 *  3. Resolve the Bangumi episode ID for `episodeNumber` by its sort number.
 *  4. Call `PUT /v0/users/-/collections/{subject_id}/episodes` with type=2 (watched) or type=0 (unwatched).
 */
export async function autoPushEpisodeToBangumi(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
): Promise<void> {
    const { token } = useBangumiStore.getState();
    if (!token) return;

    // Lazy-import to avoid circular deps at module load time
    const { useProgressStore } = await import('../store/useProgressStore');
    const { bangumiGetEpisodes, bangumiPutEpisodes } = await import('../api/bangumiService');

    const seasonRecKey = `tmdb_tv_${tvId}_s${seasonNumber}`;
    const store = useProgressStore.getState();
    const rec = store.data.records[seasonRecKey];
    if (!rec || rec.type !== 'tv_season') return;

    const subject_id = rec.bangumi_subject_id;
    if (!subject_id) return;

    try {
        // Use cached map or fetch it
        let idMap: Record<string, number> = rec.bangumi_episode_ids ?? {};

        if (!idMap[String(episodeNumber)]) {
            const episodes = await bangumiGetEpisodes(subject_id);
            const newMap: Record<string, number> = {};
            for (const ep of episodes) {
                // ep.sort is the display episode number (1, 2, 3, …)
                newMap[String(Math.round(ep.sort))] = ep.id;
            }
            idMap = newMap;

            // Persist the episode ID cache into the store
            useProgressStore.setState((s) => ({
                data: {
                    ...s.data,
                    records: {
                        ...s.data.records,
                        [seasonRecKey]: {
                            ...s.data.records[seasonRecKey],
                            bangumi_episode_ids: newMap,
                        },
                    },
                },
            }));
        }

        const bgmEpId = idMap[String(episodeNumber)];
        if (!bgmEpId) return; // No matching episode on Bangumi side

        await bangumiPutEpisodes(token, subject_id, [bgmEpId], watched ? 2 : 0);
    } catch {
        // Silently fail — never interrupt the user's local flow
    }
}
