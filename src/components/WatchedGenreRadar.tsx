import {Box, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import {useId, useMemo} from 'react';
import type {ProgressRecord} from '../types';
import type {MediaMetadata} from '../utils/mediaMetadataCache';
import {buildWatchedRadarStats, type WatchedRadarAxis, type WatchedRadarKind} from '../utils/watchedRadar';

interface Props {
    kind: WatchedRadarKind;
    records: readonly ProgressRecord[];
    metadata: Record<string, MediaMetadata>;
    pending: boolean;
    filmColor: string;
    tvColor: string;
}

const RADIUS = 104;

/** 密集标签按两侧的垂直顺序避让，保留全部类型，不依赖屏幕宽度缩小字号。 */
function createRadarLayout(axes: (WatchedRadarAxis | null)[]) {
    const count = axes.length;
    const dense = count > 6;
    const labels = axes.map((axis, index) => {
        const angle = index * Math.PI * 2 / count - Math.PI / 2;
        const cosine = Math.cos(angle);
        const side = Math.abs(cosine) < 0.01 ? 0 : cosine > 0 ? 1 : -1;
        const name = Array.from(axis?.name ?? '—');
        const lines = Array.from({length: Math.ceil(name.length / 6)}, (_, i) => name.slice(i * 6, (i + 1) * 6).join(''));
        return {side, lines, x: 210 + cosine * RADIUS * 1.37, y: Math.sin(angle) * RADIUS * 1.37};
    });
    const gap = Math.max(...labels.map(label => label.lines.length)) * 15 + 29;
    const sideCount = Math.max(...[-1, 1].map(side => labels.filter(label => label.side === side).length));
    const height = dense ? Math.max(360, (sideCount - 1) * gap + 100) : 360;
    const center = {x: 210, y: height / 2};
    labels.forEach(label => {
        label.y += center.y - (label.lines.length - 1) * 7;
    });
    if (dense) {
        for (const side of [-1, 1]) {
            const column = labels.filter(label => label.side === side).sort((a, b) => a.y - b.y);
            column.forEach((label, index) => {
                label.x = center.x + side * 127;
                label.y = Math.max(label.y, index ? column[index - 1].y + gap : 48);
            });
            for (let index = column.length - 1; index >= 0; index--) {
                column[index].y = Math.min(column[index].y, index === column.length - 1 ? height - 48 : column[index + 1].y - gap);
            }
        }
    }
    const point = (index: number, ratio = 1) => {
        const angle = index * Math.PI * 2 / count - Math.PI / 2;
        return {x: center.x + Math.cos(angle) * RADIUS * ratio, y: center.y + Math.sin(angle) * RADIUS * ratio};
    };
    const points = (ratios: number[]) => ratios.map((ratio, index) => {
        const {x, y} = point(index, ratio);
        return `${x},${y}`;
    }).join(' ');
    return {center, height, dense, labels, point, points};
}

/** 跟随页面的影视类别统计，包含未标注类型，不额外请求资料。 */
export default function WatchedGenreRadar({kind, records, metadata, pending, filmColor, tvColor}: Props) {
    const theme = useTheme();
    const id = useId();
    const stats = useMemo(() => buildWatchedRadarStats(records, metadata, kind), [records, metadata, kind]);
    const layout = useMemo(() => createRadarLayout(stats.axes), [stats.axes]);
    const isMovie = kind === 'movie';
    const label = isMovie ? '电影' : '电视剧';
    const unit = isMovie ? '部' : '季';
    const color = isMovie ? filmColor : tvColor;
    const hasData = stats.axes.some(Boolean);
    const summary = stats.axes.filter(axis => axis !== null)
        .map(axis => `${axis.name} ${axis.count} ${unit}`).join('，');

    return <Box component="section" aria-labelledby={`${id}-heading`}
                sx={{mt: 3, pt: 3, borderTop: 1, borderColor: 'divider', minWidth: 0}}>
        <Typography id={`${id}-heading`} component="h3" fontSize={18} fontWeight={750}>类型偏好</Typography>
        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1}} aria-live="polite">
            {stats.total} {unit}{label} · {stats.genreCount} 个类型
        </Typography>
        <Box sx={{
            width: '100%',
            maxWidth: 440,
            aspectRatio: `420 / ${layout.height}`,
            mx: 'auto',
            display: 'grid',
            alignItems: 'center'
        }}>
            {hasData ? <Box component="svg" viewBox={`0 0 420 ${layout.height}`} role="img"
                            aria-labelledby={`${id}-title ${id}-description`}
                            sx={{display: 'block', width: '100%', height: '100%', overflow: 'hidden'}}>
                <title id={`${id}-title`}>{label}类型偏好雷达图</title>
                <desc
                    id={`${id}-description`}>{summary}。展示全部 {stats.genreCount} 种类型{stats.unknownCount > 0 ? '及未标注类型' : ''}，刻度上限 {stats.maximum} {unit}，空轴表示没有其他类型数据。
                </desc>
                {[1, 2, 3, 4].map(level => <polygon key={level}
                                                    points={layout.points(Array(stats.axes.length).fill(level / 4))}
                                                    fill={level === 4 ? alpha(color, 0.025) : 'none'}
                                                    stroke={theme.palette.divider} strokeWidth="1"/>)}
                {stats.axes.map((_, index) => <line key={index} x1={layout.center.x} y1={layout.center.y}
                                                    x2={layout.point(index).x} y2={layout.point(index).y}
                                                    stroke={theme.palette.divider} strokeWidth="1"/>)}
                {[1, 2, 3, 4].map(level => <text key={level} x={layout.center.x + 7}
                                                 y={layout.center.y - RADIUS * level / 4 + 4}
                                                 fill={theme.palette.text.secondary} fontSize="10"
                                                 fontFamily="inherit">{stats.step * level}</text>)}
                <polygon data-radar-shape="true"
                         points={layout.points(stats.axes.map(axis => (axis?.count ?? 0) / stats.maximum))}
                         fill={alpha(color, 0.2)} stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                {stats.axes.map((axis, index) => {
                    const position = layout.point(index, (axis?.count ?? 0) / stats.maximum);
                    const labelPosition = layout.labels[index];
                    const anchor = labelPosition.side === 0 ? 'middle' : labelPosition.side > 0 ? 'start' : 'end';
                    const start = layout.point(index, 1.04);
                    const elbow = layout.point(index, 1.16);
                    return <g key={axis?.key ?? `empty-${index}`}>
                        {layout.dense && labelPosition.side !== 0 && <polyline
                            points={`${start.x},${start.y} ${elbow.x},${elbow.y} ${labelPosition.x - labelPosition.side * 6},${labelPosition.y + 3}`}
                            fill="none" stroke={theme.palette.divider} strokeWidth="1"/>}
                        {axis && <circle cx={position.x} cy={position.y} r="3.5" fill={color}
                                         stroke={theme.palette.background.paper} strokeWidth="1.5">
                            <title>{axis.name}：{axis.count} {unit}，占比 {Math.round(axis.share * 100)}%</title>
                        </circle>}
                        <text data-radar-label="true" x={labelPosition.x} y={labelPosition.y}
                              textAnchor={anchor} fill={axis ? theme.palette.text.primary : theme.palette.text.disabled}
                              fontFamily="inherit" fontSize="13" fontWeight="600">
                            {labelPosition.lines.map((line, lineIndex) => <tspan key={lineIndex} x={labelPosition.x}
                                                                                 dy={lineIndex ? 15 : 0}>{line}</tspan>)}
                            {axis && <tspan x={labelPosition.x} dy="18" fill={color} fontSize="12" fontWeight="700">
                                {axis.count} {unit}
                            </tspan>}
                        </text>
                    </g>;
                })}
            </Box> : <Typography variant="body2" color="text.secondary" textAlign="center" sx={{px: 2}}>
                {pending && stats.resolved < stats.total ? '正在整理类型资料…' : `暂无已看${label}类型数据`}
            </Typography>}
        </Box>
    </Box>;
}
