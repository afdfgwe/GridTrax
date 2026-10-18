import {useEffect, useState} from 'react';
import {requestErrorMessage} from '../utils/requestError';

/** 结果绑定本次资源和重试次数；清理时忽略旧结果，避免路由切换后串数据。 */
export function useAsyncResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ key: string; attempt: number; data?: T; error?: string }>();
    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => loader(controller.signal)).then((data) => {
            if (!controller.signal.aborted) setResult({key, attempt, data});
        }).catch((error: unknown) => {
            if (!controller.signal.aborted) setResult({key, attempt, error: requestErrorMessage(error)});
        });
        return () => controller.abort();
    }, [key, attempt, loader]);
    const current = result?.key === key && result.attempt === attempt ? result : undefined;
    return {
        data: current?.data,
        error: current?.error,
        loading: !current,
        retry: () => setAttempt((value) => value + 1),
    };
}
