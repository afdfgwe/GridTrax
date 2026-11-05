import {Box, Tooltip, Typography, useMediaQuery} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import {useState} from 'react';
import type {WatchedGenreRow, WatchedKind} from '../../utils/stats/watchedGenres';

interface Props {
    rows: WatchedGenreRow[];
    kind: WatchedKind;
    selected?: string;
    onSelect: (key: string) => void;
    filmColor: string;
    tvColor: string;
}

/** 电影与电视剧独立叠加面积，不堆叠纵坐标；空评分档始终保留为零。 */
export default function WatchedScoreChart({rows, kind, selected, onSelect, filmColor, tvColor}: Props) {
    const theme = useTheme();
    const compact = useMediaQuery(theme.breakpoints.down('sm'));
    const [hovered, setHovered] = useState<string>();
    const width = compact ? 360 : 560;
    const height = 300;
    const left = 34;
    const right = 12;
    const top = 24;
    const bottom = 248;
    const plotWidth = width - left - right;
    const step = plotWidth / 10;
    const series = [
        {key: 'movies' as const, label: '电影', color: filmColor, visible: kind !== 'tv_season'},
        {key: 'seasons' as const, label: '电视剧', color: tvColor, visible: kind !== 'movie'},
    ].filter(item => item.visible);
    const maxCount = Math.max(1, ...rows.flatMap(row => series.map(item => row[item.key])));
    const tickStep = Math.max(1, Math.ceil(maxCount / 4));
    const ceiling = tickStep * 4;
    const y = (count: number) => bottom - count / ceiling * (bottom - top);
    const x = (index: number) => left + step * (index + 0.5);
    const active = hovered ?? selected;

    return <Box component="svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="TMDB 评分分布面积折线图"
                sx={{display: 'block', width: '100%', overflow: 'visible', color: 'text.secondary'}}>
        {[0, 1, 2, 3, 4].map(tick => {
            const value = tick * tickStep;
            return <g key={tick} aria-hidden="true">
                <line x1={left} x2={width - right} y1={y(value)} y2={y(value)}
                      stroke={theme.palette.divider} strokeDasharray={tick ? '3 5' : undefined}/>
                <text x={left - 9} y={y(value) + 4} textAnchor="end" fill="currentColor" fontSize={12}>{value}</text>
            </g>;
        })}
        <text x={left} y={12} fill="currentColor" fontSize={11}>数量</text>
        {series.map(item => {
            const points = rows.map((row, index) => `${x(index)},${y(row[item.key])}`);
            return <g key={item.key} aria-hidden="true" data-score-series={item.key}>
                <path d={`M ${x(0)},${bottom} L ${points.join(' L ')} L ${x(9)},${bottom} Z`}
                      fill={alpha(item.color, 0.13)}/>
                <polyline points={points.join(' ')} fill="none" stroke={item.color} strokeWidth={2.5}
                          strokeLinejoin="round" strokeLinecap="round"/>
                {rows.map((row, index) => <circle key={row.key} cx={x(index)} cy={y(row[item.key])}
                                                  r={active === row.key ? 5 : 3} fill={theme.palette.background.paper}
                                                  stroke={item.color} strokeWidth={2}/>)}
            </g>;
        })}
        {rows.map((row, index) => <Tooltip key={row.key} arrow describeChild enterTouchDelay={350}
                                           title={<Box sx={{py: 0.25}}>
                                               <Typography variant="caption"
                                                           fontWeight={700}>{row.name} · {row.records.length} 条</Typography>
                                               {series.map(item => <Typography key={item.key} variant="caption"
                                                                               component="div">
                                                   {item.label} {row[item.key]}{item.key === 'movies' ? ' 部' : ' 季'}
                                               </Typography>)}
                                               <Typography variant="caption"
                                                           component="div">占比 {Math.round(row.share * 100)}%</Typography>
                                           </Box>}>
            <Box component="g" role="button" tabIndex={0} aria-pressed={selected === row.key}
                 aria-label={`${row.name}，${row.records.length} 条，占比 ${Math.round(row.share * 100)}%`}
                 onMouseEnter={() => setHovered(row.key)} onMouseLeave={() => setHovered(undefined)}
                 onFocus={() => setHovered(row.key)} onBlur={() => setHovered(undefined)}
                 onClick={() => onSelect(row.key)} onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(row.key);
                }
            }} sx={{
                cursor: 'pointer', outline: 'none', '&:focus-visible rect': {
                    stroke: theme.palette.primary.main, strokeWidth: 1.5,
                }
            }}>
                <rect x={left + step * index} y={top - 8} width={step} height={bottom - top + 40} rx={3}
                      fill={active === row.key ? alpha(theme.palette.primary.main, 0.07) : 'transparent'}/>
                {active === row.key && <line x1={x(index)} x2={x(index)} y1={top} y2={bottom}
                                             stroke={alpha(theme.palette.text.secondary, 0.45)} strokeDasharray="3 4"/>}
                <text x={x(index)} y={bottom + 23} textAnchor="middle" fontSize={compact ? 11 : 12}
                      fontWeight={selected === row.key ? 750 : 400}
                      fill={selected === row.key ? theme.palette.text.primary : 'currentColor'}>{index}-{index + 1}</text>
            </Box>
        </Tooltip>)}
        <text x={width - right} y={height - 4} textAnchor="end" fill="currentColor" fontSize={11}>TMDB 评分</text>
    </Box>;
}
