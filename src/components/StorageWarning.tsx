import {Alert, Button} from '@mui/material';
import {useSyncExternalStore} from 'react';
import {useProgressStore} from '../store/useProgressStore';
import {getStorageError, progressStorage, subscribeStorageError} from '../utils/progressStorage';

/** 保存失败持续展示，成功保存后自动消失；不把错误状态写回观影数据。 */
export default function StorageWarning() {
    const error = useSyncExternalStore(subscribeStorageError, getStorageError);
    if (!error) return null;
    return <Alert severity="error" sx={{mx: 2, my: 1}} action={<Button color="inherit" size="small" onClick={() => {
        // 点击时读取最新内存状态，避免重试时保存成告警刚出现那一刻的旧快照。
        progressStorage.retry(JSON.stringify({state: {data: useProgressStore.getState().data}, version: 0}));
    }}>重试保存</Button>}>{error}</Alert>;
}
