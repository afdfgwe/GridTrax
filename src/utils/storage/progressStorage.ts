import {parseBackup} from './dataBackup.ts';

export const PROGRESS_STORAGE_KEY = 'gridtrax-progress';
const RECOVERY_KEY = 'gridtrax-progress-before-import';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

// Zustand 的持久化外层是 state.data，复用备份校验规则检查内部记录是否可安全恢复。
function validateStored(value: string) {
    const persisted = JSON.parse(value);
    parseBackup(JSON.stringify(persisted.state.data));
    return value;
}

/** 日常保存失败保留内存数据；整体导入须先保存快照和新数据，成功后再更新内存。 */
export function createProgressStorage(access: () => StorageAccess, notify: (message: string | null) => void) {
    // 读取失败后锁住自动保存，防止初始化得到的空状态反过来覆盖损坏但可能可恢复的原文。
    let readFailed = false;
    return {
        getItem(name: string): string | null {
            try {
                const value = access().getItem(name);
                if (value !== null) validateStored(value);
                return value;
            } catch {
                readFailed = true;
                notify('本地记录读取失败，已暂停自动保存以保护原始数据。请先检查浏览器存储或导入有效备份。');
                return null;
            }
        },
        setItem(name: string, value: string) {
            if (readFailed) return;
            try {
                access().setItem(name, value);
                notify(null);
            } catch {
                notify('观影记录尚未保存到浏览器。请重试保存或立即导出 JSON，关闭页面可能丢失本次修改。');
            }
        },
        retry(value: string) {
            if (readFailed) return;
            this.setItem(PROGRESS_STORAGE_KEY, value);
        },
        replace(value: string, current: string) {
            validateStored(value);
            const storage = access();
            // 主记录写入失败时仍保留旧记录；快照写入失败则根本不开始覆盖。
            // 若原记录损坏，也保留原文，便于人工排查而不是静默覆盖。
            const original = readFailed ? storage.getItem(PROGRESS_STORAGE_KEY) ?? current : current;
            storage.setItem(RECOVERY_KEY, JSON.stringify({saved_at: Date.now(), value: original}));
            storage.setItem(PROGRESS_STORAGE_KEY, value);
            readFailed = false;
            notify(null);
        },
        recovery(): { saved_at: number; value: string } | null {
            const raw = access().getItem(RECOVERY_KEY);
            if (!raw) return null;
            const snapshot = JSON.parse(raw);
            if (!Number.isFinite(snapshot.saved_at) || typeof snapshot.value !== 'string') throw new Error('Invalid recovery');
            return snapshot;
        },
    };
}

// 独立订阅保存错误，不让错误提示自身的更新再次触发观影数据持久化。
let storageError: string | null = null;
const listeners = new Set<() => void>();
export const subscribeStorageError = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
export const getStorageError = () => storageError;
export const progressStorage = createProgressStorage(() => window.localStorage, (message) => {
    if (message === storageError) return;
    storageError = message;
    listeners.forEach((listener) => listener());
});
