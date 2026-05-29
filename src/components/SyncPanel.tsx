import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import React, { useRef, useState } from 'react';
import { mergeProgressData, webdavDownload, webdavUpload } from '../api/webdavService';
import { useBangumiStore } from '../store/useBangumiStore';
import { useProgressStore } from '../store/useProgressStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { WebDAVConfig } from '../store/useWebDAVStore';
import { useWebDAVStore } from '../store/useWebDAVStore';
import type { ProgressData, SyncPayload } from '../types';

// ── Animation ────────────────────────────────────────────────────────────────

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

// ── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';
interface StatusResult { type: SyncStatus; message: string; }
const idle: StatusResult = { type: 'idle', message: '' };

// ── Sub-components ───────────────────────────────────────────────────────────

const StatusAlert: React.FC<{ status: StatusResult }> = ({ status }) => (
    <Collapse in={status.type !== 'idle'} unmountOnExit>
        <Box sx={{ mt: 1.5 }}>
            {status.type === 'loading' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">{status.message}</Typography>
                </Box>
            )}
            {status.type === 'success' && (
                <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} sx={{ py: 0.5, borderRadius: 2 }}>
                    {status.message}
                </Alert>
            )}
            {status.type === 'error' && (
                <Alert severity="error" icon={<ErrorIcon fontSize="inherit" />} sx={{ py: 0.5, borderRadius: 2 }}>
                    {status.message}
                </Alert>
            )}
        </Box>
    </Collapse>
);

// ── Main Component ────────────────────────────────────────────────────────────

const SyncPanel: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { config, setConfig } = useWebDAVStore();
    const [formConfig, setFormConfig] = useState<WebDAVConfig>(config);

    const progressData = useProgressStore((s) => s.data);
    const { tmdbApiKey, setTmdbApiKey } = useSettingsStore();

    const [tmdbKey, setTmdbKey] = useState(tmdbApiKey || '');

    const [webdavStatus, setWebdavStatus] = useState<StatusResult>(idle);
    const [jsonStatus, setJsonStatus] = useState<StatusResult>(idle);
    const [generalStatus, setGeneralStatus] = useState<StatusResult>(idle);
    const [syncing, setSyncing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const isConfigured = !!(config.url && config.username && config.password);
    const isFormValid = !!(formConfig.url && formConfig.username && formConfig.password && formConfig.filePath);
    const recordCount = Object.keys(progressData.records).length;

    const openDialog = () => {
        setFormConfig(config);
        setTmdbKey(useSettingsStore.getState().tmdbApiKey || '');
        setWebdavStatus(idle);
        setJsonStatus(idle);
        setGeneralStatus(idle);
        setOpen(true);
    };

    // ── Smart sync button ─────────────────────────────────────────────────────
    const handleSmartSync = async () => {
        if (!isConfigured) {
            openDialog();
            return;
        }
        setSyncing(true);
        try {
            const remoteData = await webdavDownload(config);
            let finalData: ProgressData;
            
            if (!remoteData) {
                finalData = { ...progressData, last_sync: Date.now() };
            } else {
                // Determine if remoteData is a SyncPayload (has metadata) or just ProgressData
                const isSyncPayload = 'metadata' in remoteData;
                const remoteProgressData = isSyncPayload ? (remoteData as SyncPayload).progressData : (remoteData as ProgressData);
                
                finalData = { ...mergeProgressData(progressData, remoteProgressData), last_sync: Date.now() };

                // Restore Settings and Bangumi Configurations if they exist in the remote payload
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
            }

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

            await webdavUpload(config, uploadPayload);
            useProgressStore.setState((s) => ({ ...s, data: finalData }));
        } catch {
            // Silently fail for quick sync; user can open settings for details
        } finally {
            setSyncing(false);
        }
    };

    // ── WebDAV actions ────────────────────────────────────────────────────────
    const handleSaveConfig = () => {
        setConfig(formConfig);
        setWebdavStatus({ type: 'success', message: '配置已保存' });
    };

    const handleWebDAVSync = async () => {
        setConfig(formConfig);
        setWebdavStatus({ type: 'loading', message: '正在双向同步…' });
        try {
            const remoteData = await webdavDownload(formConfig);
            let finalData: ProgressData;
            
            if (!remoteData) {
                finalData = { ...progressData, last_sync: Date.now() };
            } else {
                const isSyncPayload = 'metadata' in remoteData;
                const remoteProgressData = isSyncPayload ? (remoteData as SyncPayload).progressData : (remoteData as ProgressData);
                
                finalData = { ...mergeProgressData(progressData, remoteProgressData), last_sync: Date.now() };

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
            }

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

            await webdavUpload(formConfig, uploadPayload);
            useProgressStore.setState((s) => ({ ...s, data: finalData }));
            setWebdavStatus({ type: 'success', message: '双向同步完成！' });
        } catch (e) {
            setWebdavStatus({ type: 'error', message: (e as Error).message });
        }
    };

    const handleWebDAVDownload = async () => {
        setConfig(formConfig);
        setWebdavStatus({ type: 'loading', message: '正在下载…' });
        try {
            const remoteData = await webdavDownload(formConfig);
            if (!remoteData) {
                setWebdavStatus({ type: 'error', message: '远程文件不存在，请先上传一次。' });
                return;
            }

            const isSyncPayload = 'metadata' in remoteData;
            const finalData = isSyncPayload ? (remoteData as SyncPayload).progressData : (remoteData as ProgressData);

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

            useProgressStore.setState((s) => ({ ...s, data: finalData }));
            setWebdavStatus({ type: 'success', message: '已用远程数据覆盖本地。' });
        } catch (e) {
            setWebdavStatus({ type: 'error', message: (e as Error).message });
        }
    };

    const handleWebDAVUpload = async () => {
        setConfig(formConfig);
        setWebdavStatus({ type: 'loading', message: '正在上传…' });
        try {
            const uploadData: ProgressData = { ...progressData, last_sync: Date.now() };
            await webdavUpload(formConfig, uploadData);
            setWebdavStatus({ type: 'success', message: '上传成功！数据已保存至 WebDAV。' });
        } catch (e) {
            setWebdavStatus({ type: 'error', message: (e as Error).message });
        }
    };

    // ── JSON actions ──────────────────────────────────────────────────────────
    const handleJsonExport = () => {
        try {
            const bangumiState = useBangumiStore.getState();
            const settingsState = useSettingsStore.getState();
            const exportData = {
                metadata: {
                    version: 3,
                    exported_at: new Date().toISOString(),
                },
                progressData: { ...progressData, last_sync: Date.now() },
                bangumi: {
                    token: bangumiState.token,
                    username: bangumiState.username,
                    userId: bangumiState.userId,
                    nickname: bangumiState.nickname,
                    lastSyncAt: bangumiState.lastSyncAt,
                    autoSyncEnabled: bangumiState.autoSyncEnabled,
                },
                settings: {
                    tmdbApiKey: settingsState.tmdbApiKey,
                },
            };
            const blob = new Blob(
                [JSON.stringify(exportData, null, 2)],
                { type: 'application/json' }
            );
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `gridtrax_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            setJsonStatus({ type: 'success', message: '已导出 JSON 备份文件。' });
        } catch (e) {
            setJsonStatus({ type: 'error', message: (e as Error).message });
        }
    };

    const handleJsonImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target?.result as string);
                let incomingProgress: ProgressData;

                if (parsed.metadata?.version >= 2 && parsed.progressData) {
                    incomingProgress = parsed.progressData;
                    if (parsed.bangumi) {
                        useBangumiStore.setState({
                            token: parsed.bangumi.token || '',
                            username: parsed.bangumi.username || '',
                            userId: parsed.bangumi.userId || null,
                            nickname: parsed.bangumi.nickname || '',
                            lastSyncAt: parsed.bangumi.lastSyncAt || null,
                            autoSyncEnabled: parsed.bangumi.autoSyncEnabled ?? false,
                        });
                    }
                    if (parsed.settings?.tmdbApiKey) {
                        useSettingsStore.getState().setTmdbApiKey(parsed.settings.tmdbApiKey);
                    }
                    // Legacy v2: tmdb_api_key was stored inside progressData
                    if (!parsed.settings?.tmdbApiKey && parsed.progressData?.tmdb_api_key) {
                        useSettingsStore.getState().setTmdbApiKey(parsed.progressData.tmdb_api_key);
                    }
                } else {
                    incomingProgress = parsed as ProgressData;
                }

                if (!incomingProgress?.records) throw new Error('文件格式不正确，缺少 records 字段。');

                useProgressStore.setState((s) => ({ ...s, data: incomingProgress }));
                setJsonStatus({ type: 'success', message: `已成功导入 ${Object.keys(incomingProgress.records).length} 条记录。` });
            } catch (err) {
                setJsonStatus({ type: 'error', message: (err as Error).message });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const isWebdavLoading = webdavStatus.type === 'loading';

    return (
        <>
            {/* ── Navbar: Smart Sync Button ── */}
            <Tooltip title={isConfigured ? '双向同步' : '配置云同步'}>
                <IconButton
                    onClick={handleSmartSync}
                    size="small"
                    sx={{
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main', backgroundColor: (t) => alpha(t.palette.primary.main, 0.08) },
                    }}
                >
                    <SyncIcon
                        sx={syncing ? { animation: `${spin} 1s linear infinite` } : undefined}
                    />
                </IconButton>
            </Tooltip>

            {/* ── Navbar: Settings Button ── */}
            <Tooltip title="同步设置">
                <IconButton
                    onClick={openDialog}
                    size="small"
                    sx={{
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main', backgroundColor: (t) => alpha(t.palette.primary.main, 0.08) },
                    }}
                >
                    <SettingsIcon />
                </IconButton>
            </Tooltip>

            {/* ── Dialog ── */}
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3, backgroundImage: 'none' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SyncIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight={700}>数据同步</Typography>
                        <Chip label={`${recordCount} 条记录`} size="small" sx={{ ml: 'auto', fontWeight: 600 }} />
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ pt: 0 }}>
                    <Stack spacing={3}>

                        {/* ── General Settings ── */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                                全局设置
                            </Typography>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <TextField
                                        label="TMDB API Token (V4 Bearer)"
                                        placeholder="留空则使用部署时的默认环境变量..."
                                        value={tmdbKey}
                                        onChange={(e) => setTmdbKey(e.target.value)}
                                        size="small"
                                        type={showPassword ? 'text' : 'password'}
                                        fullWidth
                                        slotProps={{
                                            inputLabel: { shrink: true },
                                            input: {
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Button
                                                            size="small"
                                                            onClick={() => setShowPassword((v) => !v)}
                                                            sx={{ minWidth: 0, px: 1, fontSize: '0.7rem', color: 'text.secondary' }}
                                                        >
                                                            {showPassword ? '隐藏' : '显示'}
                                                        </Button>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                    />
                                    <Tooltip title="保存设置" placement="top" arrow>
                                        <IconButton
                                            color="primary"
                                            onClick={() => {
                                                setTmdbApiKey(tmdbKey);
                                                setGeneralStatus({ type: 'success', message: 'TMDB Token 已保存，立即生效。' });
                                            }}
                                            sx={{
                                                border: 1,
                                                borderColor: 'divider',
                                                borderRadius: 2,
                                                height: 40,
                                                width: 40,
                                                '&:hover': { borderColor: 'primary.main', backgroundColor: (t) => alpha(t.palette.primary.main, 0.08) },
                                            }}
                                        >
                                            <SaveIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                                <StatusAlert status={generalStatus} />
                            </Stack>
                        </Box>

                        <Divider />

                        {/* ── JSON Import/Export ── */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                                JSON 导入 / 导出
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={handleJsonExport}
                                    fullWidth
                                    sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
                                >
                                    导出备份
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<UploadFileIcon />}
                                    onClick={() => fileInputRef.current?.click()}
                                    fullWidth
                                    sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
                                >
                                    导入备份
                                </Button>
                            </Stack>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: 'none' }}
                                onChange={handleJsonImportFile}
                            />
                            <StatusAlert status={jsonStatus} />
                        </Box>

                        <Divider />

                        {/* ── WebDAV Config ── */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                                WebDAV 云同步
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2 }}>
                                兼容 Nextcloud、坚果云、Alist/Openlist 等服务（需开启 CORS）
                            </Typography>

                            <Stack spacing={2}>
                                <TextField
                                    label="WebDAV 地址"
                                    placeholder="https://dav.example.com/dav/username"
                                    value={formConfig.url}
                                    onChange={(e) => setFormConfig((c) => ({ ...c, url: e.target.value }))}
                                    size="small"
                                    fullWidth
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                    <TextField
                                        label="用户名"
                                        value={formConfig.username}
                                        onChange={(e) => setFormConfig((c) => ({ ...c, username: e.target.value }))}
                                        size="small"
                                        fullWidth
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                    <TextField
                                        label="密码 / App Token"
                                        type={showPassword ? 'text' : 'password'}
                                        value={formConfig.password}
                                        onChange={(e) => setFormConfig((c) => ({ ...c, password: e.target.value }))}
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            inputLabel: { shrink: true },
                                            input: {
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Button
                                                            size="small"
                                                            onClick={() => setShowPassword((v) => !v)}
                                                            sx={{ minWidth: 0, px: 1, fontSize: '0.7rem', color: 'text.secondary' }}
                                                        >
                                                            {showPassword ? '隐藏' : '显示'}
                                                        </Button>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                    />
                                </Stack>
                                <TextField
                                    label="远程文件路径"
                                    placeholder="/gridtrax/data.json"
                                    value={formConfig.filePath}
                                    onChange={(e) => setFormConfig((c) => ({ ...c, filePath: e.target.value }))}
                                    size="small"
                                    fullWidth
                                    slotProps={{
                                        inputLabel: { shrink: true },
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <FolderOpenIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />


                            </Stack>
                        </Box>

                        {/* ── WebDAV Action Buttons ── */}
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
                            {/* Main: bidirectional sync */}
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleWebDAVSync}
                                disabled={!isFormValid || isWebdavLoading}
                                startIcon={
                                    isWebdavLoading
                                        ? <CircularProgress size={16} color="inherit" />
                                        : <SyncIcon sx={isWebdavLoading ? { animation: `${spin} 1s linear infinite` } : undefined} />
                                }
                                sx={{ borderRadius: 2, fontWeight: 700, flex: 1, whiteSpace: 'nowrap' }}
                            >
                                双向同步
                            </Button>

                            {/* Icon-only: download */}
                            <Tooltip title="仅下载（远程覆盖本地）" arrow>
                                <span>
                                    <IconButton
                                        onClick={handleWebDAVDownload}
                                        disabled={!isFormValid || isWebdavLoading}
                                        sx={{
                                            border: 1,
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                                        }}
                                    >
                                        <CloudDownloadIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            {/* Icon-only: upload */}
                            <Tooltip title="仅上传（本地覆盖远程）" arrow>
                                <span>
                                    <IconButton
                                        onClick={handleWebDAVUpload}
                                        disabled={!isFormValid || isWebdavLoading}
                                        sx={{
                                            border: 1,
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                                        }}
                                    >
                                        <CloudUploadIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            {/* Icon-only: save config */}
                            <Tooltip title="仅保存配置 (不同步)" arrow>
                                <span>
                                    <IconButton
                                        onClick={handleSaveConfig}
                                        disabled={!isFormValid}
                                        sx={{
                                            border: 1,
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                                        }}
                                    >
                                        <SaveIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>

                        <StatusAlert status={webdavStatus} />

                    </Stack>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default SyncPanel;
