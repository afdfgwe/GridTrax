import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UploadFileIcon from '@mui/icons-material/UploadFile';
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

export default function DataBackupPanel() {
    const [open, setOpen] = useState(false);
    const [reading, setReading] = useState(false);
    const [pending, setPending] = useState<ProgressData | null>(null);
    const [status, setStatus] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const recordCount = useProgressStore((state) => Object.keys(state.data.records).length);

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
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setStatus({severity: 'success', message: '已生成 JSON 备份。'});
        } catch {
            setStatus({severity: 'error', message: '导出失败，请检查本地数据后重试。'});
        }
    };

    const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setStatus(null);
        setReading(true);
        try {
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
            // Persist first: quota errors must not replace the current in-memory records.
            localStorage.setItem('gridtrax-progress', JSON.stringify({state: {data: pending}, version: 0}));
            useProgressStore.setState({data: pending});
            setPending(null);
            setStatus({severity: 'success', message: '观影记录已导入。'});
        } catch {
            setPending(null);
            setStatus({severity: 'error', message: '保存失败，请检查浏览器存储空间后重试。'});
        }
    };

    return (
        <>
            <Tooltip title="数据备份" arrow>
                <IconButton aria-label="数据备份" onClick={() => {
                    setStatus(null);
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
                        <input ref={fileInput} type="file" accept=".json,application/json" aria-label="选择 JSON 备份"
                               hidden onChange={importJson}/>
                        {status && <Alert severity={status.severity}>{status.message}</Alert>}
                    </Stack>
                </DialogContent>
            </Dialog>
            <Dialog open={!!pending} onClose={() => setPending(null)} fullWidth maxWidth="xs"
                    aria-labelledby="backup-confirm-title">
                <DialogTitle id="backup-confirm-title">覆盖本地记录？</DialogTitle>
                <DialogContent>
                    <DialogContentText>备份中的 {pending ? Object.keys(pending.records).length : 0} 条记录将替换当前 {recordCount} 条记录，此操作不可撤销。请先导出现有记录以保留备份。</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPending(null)}>取消</Button>
                    <Button variant="contained" onClick={confirmImport}>确认导入</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
