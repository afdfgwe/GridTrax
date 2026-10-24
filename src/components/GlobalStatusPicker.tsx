// 本文件还导出供快捷编辑复用的图标映射，因此保留此热更新规则例外。
/* eslint-disable react-refresh/only-export-components */
import {ToggleButton, ToggleButtonGroup} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React from 'react';
import type {WatchStatus} from '../types';
import {STATUS_LABELS} from '../types';

interface GlobalStatusPickerProps {
    status?: WatchStatus;
    onStatusChange: (status: WatchStatus) => void;
}

// 可切换的观看状态，顺序即界面展示顺序。
const STATUSES: WatchStatus[] = ['Wish', 'Do', 'Collect', 'OnHold', 'Dropped'];

// 各观看状态共用的图标：坐标范围为 24×24，默认以 14×14 像素渲染。
export const StatusIcons: Record<WatchStatus, React.ReactElement> = {
    Wish: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/>
        </svg>
    ),
    Do: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z"/>
        </svg>
    ),
    Collect: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
    ),
    OnHold: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
    ),
    Dropped: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
    ),
};

/** 受控观看状态选择器；仅上报选择，由父组件决定如何持久化记录。 */
const GlobalStatusPicker: React.FC<GlobalStatusPickerProps> = ({
                                                                   status,
                                                                   onStatusChange,
                                                               }) => {
    const theme = useTheme();
    const primary = theme.palette.primary.main;

    return (
        <ToggleButtonGroup
            value={status}
            exclusive
            // 再次点击当前项产生空值时不清空已有状态，保持互斥单选语义。
            onChange={(_, val) => val && onStatusChange(val as WatchStatus)}
            size="small"
            sx={{
                flexWrap: 'wrap',
                gap: 0.5,
                '& .MuiToggleButtonGroup-grouped': {
                    border: 'none !important',
                    borderRadius: '20px !important',
                    mx: 0,
                },
            }}
        >
            {STATUSES.map((s) => (
                <ToggleButton
                    key={s}
                    value={s}
                    sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        gap: 0.6,
                        color: status === s ? '#000' : 'text.secondary',
                        background: status === s ? primary : alpha(primary, 0.1),
                        '&.Mui-selected': {
                            background: primary,
                            color: '#000',
                            '&:hover': {background: alpha(primary, 0.85)},
                        },
                        '&:hover': {
                            background: alpha(primary, 0.2),
                        },
                        transition: 'all 150ms ease',
                    }}
                >
                    {StatusIcons[s]} {STATUS_LABELS[s]}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
};

export default GlobalStatusPicker;
