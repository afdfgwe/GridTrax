import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RestoreIcon from '@mui/icons-material/Restore';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {useProgressStore} from '../store/useProgressStore';
import type {ProgressData} from '../types';
import {createBackup, parseBackup} from '../utils/dataBackup';
import {progressStorage} from '../utils/progressStorage';

const LAST_EXPORT_KEY = 'gridtrax-last-export';
const serialize = (data: ProgressData) => JSON.stringify({state: {data}, version: 0});

/** JSON 备份入口：导出当前快照，导入须先校验再确认整体替换，不做记录合并。 */
export default function DataBackupPanel() {
    const [open, setOpen] = useState(false);
    const [reading, setReading] = useState(false);
    // 待确认数据与正式存储隔离，读取文件或取消确认都不会改动现有记录。
    const [pending, setPending] = useState<ProgressData | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [recoveryDate, setRecoveryDate] = useState<number | null>(null);
    const [lastExport, setLastExport] = useState<string | null>(null);
    const [status, setStatus] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const recordCount = useProgressStore((state) => Object.keys(state.data.records).length);

    // 在点击时读取最新存储快照；备份工具仅导出允许的观影字段，不包含 API 凭据。
    const exportJson = () => {
        try {
            const payload = createBackup(useProgressStore.getState().data);
            const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `gridtrax-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            // 给浏览器留出启动下载的时间，然后释放临时对象地址。
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            const date = new Date().toISOString();
            setLastExport(date);
            try {
                localStorage.setItem(LAST_EXPORT_KEY, date);
            } catch { /* 下载仍然成功，日期偏好不阻断导出。 */
            }
            setStatus({severity: 'success', message: '已生成 JSON 备份。'});
        } catch {
            setStatus({severity: 'error', message: '导出失败，请检查本地数据后重试。'});
        }
    };

    const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // 清空文件控件，使用户下一次仍能选择同一个文件触发导入。
        event.target.value = '';
        if (!file) return;
        setStatus(null);
        setReading(true);
        setRestoring(false);
        try {
            // 解析和兼容性校验失败会抛错，只有完整合法的数据才能进入确认步骤。
            setPending(parseBackup(await file.text()));
        } catch {
            setStatus({severity: 'error', message: '导入失败：文件不是有效或受支持的 GridTrax JSON 备份，现有记录未更改。'});
        } finally {
            setReading(false);
        }
    };

    const confirmImport = () => {
        if (!pending) return;
        try {
            // 先持久化再替换内存；存储配额等错误不能覆盖用户当前的内存记录。
            // 外层格式与 Zustand persist 一致，其中 version 是存储版本而非备份版本。
            progressStorage.replace(serialize(pending), serialize(useProgressStore.getState().data));
            useProgressStore.setState({data: pending});
            setPending(null);
            setRecoveryDate(Date.now());
            setStatus({severity: 'success', message: restoring ? '已恢复导入前的记录。' : '观影记录已导入，原记录已保留为本地恢复快照。'});
        } catch {
            setPending(null);
            setStatus({severity: 'error', message: '保存失败，当前记录未替换。请检查浏览器存储空间后重试。'});
        }
    };

    return (
        <>
            <Tooltip title="数据备份" arrow>
                <IconButton aria-label="数据备份" onClick={() => {
                    setStatus(null);
                    try {
                        setRecoveryDate(progressStorage.recovery()?.saved_at ?? null);
                        setLastExport(localStorage.getItem(LAST_EXPORT_KEY));
                    } catch {
                        setStatus({severity: 'error', message: '无法读取本地备份信息，请检查浏览器存储。'});
                    }
                    setOpen(true);
                }} sx={{color: 'text.secondary'}}>
                    <FolderOpenIcon/>
                </IconButton>
            </Tooltip>
            <Dialog open={open} onClose={() => {
                if (!reading && !pending) setOpen(false);
            }} fullWidth maxWidth="xs" aria-labelledby="backup-title">
                <DialogTitle id="backup-title"
                             sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    数据备份
                    <IconButton aria-label="关闭备份" disabled={reading || !!pending} onClick={() => setOpen(false)}
                                size="small"><CloseIcon/></IconButton>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        <Typography color="text.secondary">本地记录：{recordCount} 条</Typography>
                        <Typography variant="body2"
                                    color="text.secondary">最近生成备份：{lastExport ? new Date(lastExport).toLocaleString('zh-CN') : '暂无记录'}</Typography>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: 1,
                            '& .MuiButton-root': {
                                minWidth: 0,
                                px: {xs: 0.5, sm: 1},
                                whiteSpace: 'nowrap',
                                fontSize: {xs: '0.75rem', sm: '0.875rem'}
                            },
                            '& .MuiButton-startIcon': {ml: 0, mr: 0.5},
                            '& .MuiButton-startIcon svg': {fontSize: 18},
                        }}>
                            <Button variant="contained" startIcon={<DownloadIcon/>} onClick={exportJson}
                                    disabled={reading}>导出 JSON</Button>
                            <Button variant="outlined" startIcon={<UploadFileIcon/>}
                                    onClick={() => fileInput.current?.click()} disabled={reading}>
                                {reading ? '读取中…' : '导入 JSON'}
                            </Button>
                        </Box>
                        {recoveryDate &&
                            <Button variant="text" startIcon={<RestoreIcon/>} disabled={reading} onClick={() => {
                                try {
                                    const snapshot = progressStorage.recovery();
                                    if (!snapshot) throw new Error('Missing recovery');
                                    const stored = JSON.parse(snapshot.value);
                                    setPending(parseBackup(JSON.stringify(stored.state.data)));
                                    setRestoring(true);
                                } catch {
                                    setStatus({severity: 'error', message: '恢复快照不可用或已损坏，现有记录未更改。'});
                                }
                            }}>恢复导入前记录（{new Date(recoveryDate).toLocaleDateString('zh-CN')}）</Button>}
                        {recoveryDate && <Typography variant="caption" color="text.secondary">恢复快照仅保存在此浏览器中，不能替代下载的 JSON
                            备份。</Typography>}
                        <input ref={fileInput} type="file" accept=".json,application/json" aria-label="选择 JSON 备份"
                               hidden onChange={importJson}/>
                        {status && <Alert severity={status.severity}>{status.message}</Alert>}
                    </Stack>
                </DialogContent>
            </Dialog>
            {/* 二次确认单独呈现覆盖风险，关闭或取消时只丢弃待导入快照。 */}
            <Dialog open={!!pending} onClose={() => setPending(null)} fullWidth maxWidth="xs"
                    aria-labelledby="backup-confirm-title">
                <DialogTitle id="backup-confirm-title">{restoring ? '恢复导入前记录？' : '覆盖本地记录？'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>备份中的 {pending ? Object.keys(pending.records).length : 0} 条记录将替换当前 {recordCount} 条记录。替换前会保留一份本地恢复快照，建议同时导出
                        JSON 备份。</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPending(null)}>取消</Button>
                    <Button variant="contained" onClick={confirmImport}>{restoring ? '确认恢复' : '确认导入'}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
