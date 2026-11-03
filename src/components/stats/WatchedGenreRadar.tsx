import {Box, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import {useId, useMemo} from 'react';
import type {ProgressRecord} from '../../types';
import type {MediaMetadata} from '../../utils/media/mediaMetadataCache';
import {
    buildWatchedRadarStats,
    getWatchedRadarHighlights,
    getWatchedRadarRatio,
    type WatchedRadarAxis,
    type WatchedRadarKind
} from '../../utils/stats/watchedRadar';

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
    // 为类型和括号数量预留横向空间，避免长类型名或大数量被画布裁切。
    const labelWidth = Math.max(...axes.map(axis => Array.from(axis ? `${axis.name}（${axis.count}）` : '—')
        .reduce((width, character) => width + (character.charCodeAt(0) > 255 ? 13 : 8), 0)));
    const width = Math.max(420, 2 * (labelWidth + (dense ? 127 : RADIUS * 1.37) + 16));
    const labels = axes.map((_, index) => {
        const angle = index * Math.PI * 2 / count - Math.PI / 2;
        const cosine = Math.cos(angle);
        const side = Math.abs(cosine) < 0.01 ? 0 : cosine > 0 ? 1 : -1;
        return {side, x: width / 2 + cosine * RADIUS * 1.37, y: Math.sin(angle) * RADIUS * 1.37};
    });
    const gap = 44;
    const sideCount = Math.max(...[-1, 1].map(side => labels.filter(label => label.side === side).length));
    const height = dense ? Math.max(360, (sideCount - 1) * gap + 100) : 360;
    const center = {x: width / 2, y: height / 2};
    labels.forEach(label => {
        label.y += center.y;
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
    return {center, width, height, dense, labels, point, points};
}

/** 跟随页面的影视类别统计，包含未标注类型，不额外请求资料。 */
export default function WatchedGenreRadar({kind, records, metadata, pending, filmColor, tvColor}: Props) {
    const theme = useTheme();
    const id = useId();
    const stats = useMemo(() => buildWatchedRadarStats(records, metadata, kind), [records, metadata, kind]);
    const layout = useMemo(() => createRadarLayout(stats.axes), [stats.axes]);
    const highlights = useMemo(() => getWatchedRadarHighlights(stats.axes), [stats.axes]);
    const rankColors = theme.palette.mode === 'dark'
        ? ['#ffd166', '#c4d1df', '#efad88']
        : ['#946200', '#526779', '#a6532d'];
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
            maxWidth: Math.max(440, layout.width),
            aspectRatio: `${layout.width} / ${layout.height}`,
            mx: 'auto',
            display: 'grid',
            alignItems: 'center'
        }}>
            {hasData ? <Box component="svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img"
                            aria-labelledby={`${id}-title ${id}-description`}
                            sx={{display: 'block', width: '100%', height: '100%', overflow: 'hidden'}}>
                <title id={`${id}-title`}>{label}类型偏好雷达图</title>
                <desc
                    id={`${id}-description`}>{summary}。展示全部 {stats.genreCount} 种类型{stats.unknownCount > 0 ? '及未标注类型' : ''}，采用平方根刻度，标签为真实数量，刻度上限 {stats.maximum} {unit}，空轴表示没有其他类型数据。
                </desc>
                {[1, 2, 3, 4].map(level => <polygon key={level}
                                                    points={layout.points(Array(stats.axes.length).fill(getWatchedRadarRatio(stats.step * level, stats.maximum)))}
                                                    fill={level === 4 ? alpha(color, 0.025) : 'none'}
                                                    stroke={theme.palette.divider} strokeWidth="1"/>)}
                {stats.axes.map((_, index) => <line key={index} x1={layout.center.x} y1={layout.center.y}
                                                    x2={layout.point(index).x} y2={layout.point(index).y}
                                                    stroke={theme.palette.divider} strokeWidth="1"/>)}
                {[1, 2, 3, 4].map(level => <text key={level} x={layout.center.x + 7}
                                                 y={layout.center.y - RADIUS * getWatchedRadarRatio(stats.step * level, stats.maximum) + 4}
                                                 fill={theme.palette.text.secondary} fontSize="10"
                                                 fontFamily="inherit">{stats.step * level}</text>)}
                <polygon data-radar-shape="true"
                         points={layout.points(stats.axes.map(axis => getWatchedRadarRatio(axis?.count ?? 0, stats.maximum)))}
                         fill={alpha(color, 0.2)} stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                {stats.axes.map((axis, index) => {
                    const position = layout.point(index, getWatchedRadarRatio(axis?.count ?? 0, stats.maximum));
                    const labelPosition = layout.labels[index];
                    const anchor = labelPosition.side === 0 ? 'middle' : labelPosition.side > 0 ? 'start' : 'end';
                    const start = layout.point(index, 1.04);
                    const elbow = layout.point(index, 1.16);
                    const rank = axis ? highlights.get(axis.key) : undefined;
                    const axisColor = rank ? rankColors[rank - 1] : color;
                    return <g key={axis?.key ?? `empty-${index}`} data-radar-rank={rank}>
                        {layout.dense && labelPosition.side !== 0 && <polyline
                            points={`${start.x},${start.y} ${elbow.x},${elbow.y} ${labelPosition.x - labelPosition.side * 6},${labelPosition.y + 3}`}
                            fill="none" stroke={rank ? alpha(axisColor, 0.5) : theme.palette.divider} strokeWidth="1"/>}
                        {rank && <circle cx={position.x} cy={position.y} r="9" fill={alpha(axisColor, 0.16)}/>}
                        {axis && <circle cx={position.x} cy={position.y} r={rank ? 5 : 3.5} fill={axisColor}
                                         stroke={theme.palette.background.paper} strokeWidth="1.5">
                            <title>{rank ? `第 ${rank} 名，` : ''}{axis.name}：{axis.count} {unit}，占比 {Math.round(axis.share * 100)}%</title>
                        </circle>}
                        <text data-radar-label="true" x={labelPosition.x} y={labelPosition.y}
                              textAnchor={anchor} fill={rank ? axisColor : axis ? theme.palette.text.primary : theme.palette.text.disabled}
                              fontFamily="inherit" fontSize="13" fontWeight={rank ? 800 : 600}>
                            {axis?.name ?? '—'}
                            {axis && <tspan fill={axisColor}>（{axis.count}）</tspan>}
                        </text>
                    </g>;
                })}
            </Box> : <Typography variant="body2" color="text.secondary" textAlign="center" sx={{px: 2}}>
                {pending && stats.resolved < stats.total ? '正在整理类型资料…' : `暂无已看${label}类型数据`}
            </Typography>}
        </Box>
    </Box>;
}
