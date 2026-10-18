import {useEffect, useState} from 'react';
import {getMovie, getTVShow} from '../api/tmdb';
import {useProgressStore} from '../store/useProgressStore';
import type {ProgressRecord} from '../types';

/**
 * 为追踪列表补充 TMDB 评分和年份，并修复历史记录缺少海报的问题。
 * 请求通过 API 层共用缓存；接口数据不写入用户评分等历史字段。
 */
export function useHomeMediaDetails(records: ProgressRecord[]) {
    const [attempt, setAttempt] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [years, setYears] = useState<Record<string, string>>({});
    const fillMissingPosters = useProgressStore((state) => state.fillMissingPosters);

    useEffect(() => {
        let cancelled = false;
        // 同一部剧可能追踪多个季，按类型和作品 ID 去重后只取一次整部剧详情。
        const uniqueRecords = [...new Map(records.map((record) => [
            `${record.type}-${record.tmdb_id}`, record,
        ])).values()];

        const loadDetails = async () => {
            let failures = 0;
            // 每批最多并发 4 个请求，避免导入大量记录后同时发起过多接口调用。
            for (let i = 0; i < uniqueRecords.length; i += 4) {
                if (cancelled) return;
                await Promise.all(uniqueRecords.slice(i, i + 4).map(async (record) => {
                    const key = `${record.type}-${record.tmdb_id}`;
                    const detail = await (record.type === 'movie'
                        ? getMovie(record.tmdb_id)
                        : getTVShow(record.tmdb_id))
                        .catch(() => {
                            failures += 1;
                            return undefined;
                        });
                    if (cancelled || !detail) return;
                    // 只展示有效且大于零的 TMDB 评分；相同值直接复用旧状态。
                    if (Number.isFinite(detail.vote_average) && detail.vote_average > 0) {
                        setScores((current) => current[key] === detail.vote_average
                            ? current
                            : {...current, [key]: detail.vote_average});
                    }
                    // 电视剧年份取整部剧的首播日期，不是当前季的开播日期。
                    const date = 'release_date' in detail ? detail.release_date : detail.first_air_date;
                    if (date && /^\d{4}/.test(date)) {
                        const year = date.slice(0, 4);
                        setYears((current) => current[key] === year ? current : {...current, [key]: year});
                    }
                    fillMissingPosters(record.type, record.tmdb_id, detail.poster_path);
                }));
            }
            if (!cancelled) setFailedCount(failures);
        };

        void loadDetails();
        // 组件卸载或依赖变化后忽略旧结果；这里只停止状态写入，不中断网络请求。
        return () => {
            cancelled = true;
        };
    }, [records, fillMissingPosters, attempt]);

    return {
        scores, years, failedCount, retry: () => {
            setFailedCount(0);
            setAttempt((value) => value + 1);
        }
    };
}
