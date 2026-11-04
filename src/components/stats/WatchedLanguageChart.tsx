import {Box, ButtonBase, Tooltip, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import type {WatchedGenreRow} from '../../utils/stats/watchedGenres';
import {UNKNOWN_STAT} from '../../utils/stats/watchedStats';
import {allocateLanguageCells} from '../../utils/stats/languageWaffle';

interface Props {
    rows: WatchedGenreRow[];
    unresolved: number;
    selected?: string;
    onSelect: (key: string) => void;
}

const palette = ['#38ad9c', '#e69b58', '#668fdb', '#d9769a', '#9ca84a', '#9a7ccb', '#49a5bb', '#c27859'];
const formatShare = (share: number) => share > 0 && share < 0.001 ? '<0.1%' : `${Number((share * 100).toFixed(1))}%`;

/** 百分格图提供整体语言画像；完整图例保留小语种，避免取整后无法选择其作品。 */
export default function WatchedLanguageChart({rows, unresolved, selected, onSelect}: Props) {
    const theme = useTheme();
    const counts = [...rows.map(row => row.records.length), Math.max(0, unresolved)];
    const cells = allocateLanguageCells(counts);
    const colorFor = (index: number) => rows[index]?.key === UNKNOWN_STAT
        ? theme.palette.text.disabled : palette[index] ?? `hsl(${index * 137.508 % 360} 45% 52%)`;
    return <Box>
        <Box role="group" aria-label="原始语言占比百分格图" sx={{
            display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: {xs: 0.5, sm: 0.75},
            width: '100%', maxWidth: 300, aspectRatio: '1 / 1', mx: 'auto', mb: 1.5,
        }}>
            {cells.flatMap((count, index) => Array.from({length: count}, (_, cell) => {
                const row = rows[index];
                const label = row ? `${row.name} · ${row.records.length} 条 · ${formatShare(row.share)}` : `待补全 · ${unresolved} 条`;
                return <Tooltip key={`${index}-${cell}`} title={label} disableTouchListener>
                    <Box component="span" sx={{display: 'block', minWidth: 0, aspectRatio: '1 / 1'}}>
                    <ButtonBase tabIndex={-1} disabled={!row} aria-label={label}
                                data-language-cell={row?.key ?? 'pending'}
                                onClick={() => row && onSelect(row.key)} sx={{
                        minWidth: 0, width: '100%', height: '100%', borderRadius: '3px',
                        bgcolor: row ? colorFor(index) : 'action.disabledBackground',
                        opacity: selected && selected !== row?.key ? 0.25 : 1,
                        transition: 'opacity 160ms ease',
                        outline: selected === row?.key ? `1px solid ${alpha(theme.palette.text.primary, 0.35)}` : 'none',
                        '&:hover': {opacity: 1, filter: 'brightness(1.12)'},
                        '@media (prefers-reduced-motion: reduce)': {transition: 'none'},
                    }}/>
                    </Box>
                </Tooltip>;
            }))}
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{textAlign: 'center', mb: 2}}>
            语言占比 · 每格约 1%
        </Typography>
        <Box role="group" aria-label="观看语言列表" sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
            {rows.map((row, index) => <ButtonBase key={row.key} onClick={() => onSelect(row.key)}
                aria-pressed={selected === row.key} aria-label={`${row.name}，${row.records.length} 条，占比 ${formatShare(row.share)}`}
                sx={{
                    display: 'flex', width: '100%', gap: 1.25, px: 1.25, py: 1, borderRadius: 1, textAlign: 'left',
                    bgcolor: selected === row.key ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    '&:hover, &.Mui-focusVisible': {bgcolor: alpha(theme.palette.primary.main, 0.07)},
                }}>
                <Box sx={{width: 10, height: 10, bgcolor: colorFor(index), borderRadius: '2px', flexShrink: 0}}/>
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Typography variant="body2" fontWeight={650} sx={{overflowWrap: 'anywhere'}}>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">电影 {row.movies} · 电视剧 {row.seasons}</Typography>
                </Box>
                <Typography variant="body2" fontWeight={700} sx={{fontVariantNumeric: 'tabular-nums'}}>{row.records.length}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{minWidth: '6ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
                    {formatShare(row.share)}
                </Typography>
            </ButtonBase>)}
            {unresolved > 0 && <Typography variant="caption" color="text.secondary" sx={{px: 1.25, py: 1}}>待补全 {unresolved} 条</Typography>}
        </Box>
    </Box>;
}
