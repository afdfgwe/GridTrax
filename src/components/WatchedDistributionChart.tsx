import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Box, Button, ButtonBase, Typography} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import {useId, useState} from 'react';
import type {WatchedGenreRow} from '../utils/watchedGenres';
import {UNKNOWN_STAT, type WatchedDimension} from '../utils/watchedStats';

interface Props {
    dimension: WatchedDimension;
    rows: WatchedGenreRow[];
    selected?: string;
    onSelect: (key: string) => void;
    filmColor: string;
    tvColor: string;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;
const colors = ['#45bda8', '#eb9b71', '#83a8ed', '#db84a3', '#b4bc65', '#b19cdb', '#63b9cf', '#cf9d51'];
const COLLAPSED_GENRE_COUNT = 8;

/** 三个维度共用筛选交互；地区环形图按归属次数分配角度，年份柱图保留真实年份顺序。 */
export default function WatchedDistributionChart({dimension, rows, selected, onSelect, filmColor, tvColor}: Props) {
    const theme = useTheme();
    const [genresExpanded, setGenresExpanded] = useState(false);
    const genreRowsId = useId();
    const maxCount = Math.max(1, ...rows.map(row => row.records.length));
    const activeStyle = (key: string) => ({
        borderRadius: 1, textAlign: 'left',
        bgcolor: selected === key ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
        '&:hover, &.Mui-focusVisible': {bgcolor: alpha(theme.palette.primary.main, 0.07)},
    });
    const bars = (row: WatchedGenreRow, vertical = false) => <Box sx={{
        display: 'flex', flexDirection: vertical ? 'column-reverse' : 'row',
        height: '100%', width: '100%', overflow: 'hidden', borderRadius: 0.5,
    }}>
        <Box sx={{[vertical ? 'height' : 'width']: `${row.movies / row.records.length * 100}%`, bgcolor: filmColor}}/>
        <Box sx={{[vertical ? 'height' : 'width']: `${row.seasons / row.records.length * 100}%`, bgcolor: tvColor}}/>
    </Box>;

    if (dimension === 'country') {
        const segments = rows.reduce<{ row: WatchedGenreRow; offset: number; color: string }[]>((result, row, index) => {
            const previous = result.at(-1);
            result.push({
                row, offset: previous ? previous.offset + previous.row.share : 0,
                color: row.key === UNKNOWN_STAT ? theme.palette.text.disabled : colors[index % colors.length]
            });
            return result;
        }, []);
        const assignments = rows.reduce((sum, row) => sum + row.records.length, 0);
        const current = rows.find(row => row.key === selected);
        return <Box>
            <Box sx={{width: 240, height: 240, maxWidth: '100%', mx: 'auto', position: 'relative', mb: 2}}>
                <Box component="svg" viewBox="0 0 240 240" sx={{display: 'block', width: '100%', height: '100%'}}
                     aria-label="制片地区归属分布环形图">
                    {segments.map(({row, offset: start, color}) => <Box component="circle" key={row.key}
                                                                        cx="120" cy="120" r="84" fill="none"
                                                                        stroke={color} pathLength="1"
                                                                        strokeWidth={selected === row.key ? 34 : 26}
                                                                        strokeDasharray={`${row.share} ${1 - row.share}`}
                                                                        strokeDashoffset={-start}
                                                                        transform="rotate(-90 120 120)" role="button"
                                                                        tabIndex={0}
                                                                        aria-label={`查看${row.name}作品`}
                                                                        aria-pressed={selected === row.key}
                                                                        onClick={() => onSelect(row.key)}
                                                                        onKeyDown={event => {
                                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                                event.preventDefault();
                                                                                onSelect(row.key);
                                                                            }
                                                                        }} sx={{
                        cursor: 'pointer', opacity: selected && selected !== row.key ? 0.4 : 1,
                        '&:hover, &:focus-visible': {opacity: 1, strokeWidth: 34}, outline: 'none'
                    }}>
                        <title>{row.name}：{row.records.length} 次，{percent(row.share)}</title>
                    </Box>)}
                </Box>
                <Box sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    px: 7
                }}>
                    <Typography sx={{
                        fontSize: 30,
                        lineHeight: 1.2,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums'
                    }}>{current?.records.length ?? assignments}</Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center"
                                sx={{mt: 0.75, overflowWrap: 'anywhere'}}>{current?.name ?? '地区归属次数'}</Typography>
                </Box>
            </Box>
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 440, overflowY: 'auto'}}>
                {segments.map(({row, color}) => <ButtonBase key={row.key} onClick={() => onSelect(row.key)}
                                                            aria-pressed={selected === row.key}
                                                            aria-label={`${row.name}，${row.records.length} 条，占地区归属 ${percent(row.share)}`}
                                                            sx={{
                                                                ...activeStyle(row.key),
                                                                display: 'flex',
                                                                gap: 1.25,
                                                                px: 1.25,
                                                                py: 1,
                                                                flexShrink: 0
                                                            }}>
                    <Box sx={{width: 9, height: 9, bgcolor: color, flexShrink: 0, borderRadius: '50%'}}/>
                    <Typography variant="body2" fontWeight={650}
                                sx={{flex: 1, overflowWrap: 'anywhere'}}>{row.name}</Typography>
                    <Typography variant="body2" fontWeight={700}>{row.records.length}</Typography>
                    <Typography variant="caption" color="text.secondary"
                                sx={{width: '4ch', textAlign: 'right'}}>{percent(row.share)}</Typography>
                </ButtonBase>)}
            </Box>
        </Box>;
    }

    if (dimension === 'year') return <Box role="group" aria-label="上映与首播年份柱状图" tabIndex={0}
                                          sx={{
                                              overflowX: 'auto',
                                              overflowY: 'hidden',
                                              pb: 1,
                                              borderBottom: 1,
                                              borderColor: 'divider'
                                          }}>
        <Box sx={{
            display: 'flex',
            gap: 0.75,
            minWidth: '100%',
            width: 'max-content',
            height: 292,
            pt: 2,
            px: 0.5,
            position: 'relative'
        }}>
            {[0, 0.5, 1].map(ratio => <Box key={ratio} aria-hidden="true" sx={{
                position: 'absolute', left: 0, right: 0,
                top: 36 + 210 * ratio, borderTop: '1px dashed', borderColor: 'divider', pointerEvents: 'none'
            }}/>)}
            {rows.map(row => <ButtonBase key={row.key} onClick={() => onSelect(row.key)}
                                         aria-pressed={selected === row.key}
                                         aria-label={`${row.name}，${row.records.length} 条，占比 ${percent(row.share)}`}
                                         sx={{
                                             ...activeStyle(row.key),
                                             width: 52,
                                             flex: '1 0 52px',
                                             maxWidth: 90,
                                             display: 'flex',
                                             flexDirection: 'column',
                                             justifyContent: 'end',
                                             px: 0.75
                                         }}>
                <Box sx={{height: 230, width: '100%', display: 'flex', alignItems: 'end', justifyContent: 'center'}}>
                    <Box sx={{
                        height: `${row.records.length / maxCount * 210}px`,
                        width: '100%',
                        maxWidth: 40,
                        position: 'relative',
                        minHeight: 3
                    }}>
                        <Typography variant="caption" sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: -23,
                            textAlign: 'center',
                            fontWeight: 700
                        }}>{row.records.length}</Typography>
                        {bars(row, true)}
                    </Box>
                </Box>
                <Typography variant="caption" sx={{
                    height: 46,
                    pt: 1,
                    textAlign: 'center',
                    lineHeight: 1.4,
                    fontSize: row.key === UNKNOWN_STAT ? 10 : 12
                }}>{row.name}</Typography>
            </ButtonBase>)}
        </Box>
    </Box>;

    // 只折叠图表的展示项，统计分母、排序与已选类型保持不变。
    const visibleGenres = genresExpanded ? rows : rows.slice(0, COLLAPSED_GENRE_COUNT);
    return <Box>
        <Box id={genreRowsId} sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
        {visibleGenres.map((row, index) => <ButtonBase key={row.key} onClick={() => onSelect(row.key)}
                                              aria-pressed={selected === row.key}
                                              aria-label={`${row.name}，${row.records.length} 条，占比 ${percent(row.share)}`}
                                              sx={{
                                                  ...activeStyle(row.key),
                                                  display: 'block',
                                                  width: '100%',
                                                  px: 1.25,
                                                  py: 1.25
                                              }}>
            <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75}}>
                <Typography variant="caption" color="text.disabled" sx={{
                    width: 18,
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums'
                }}>{String(index + 1).padStart(2, '0')}</Typography>
                <Typography variant="body2" fontWeight={650}
                            sx={{flex: 1, overflowWrap: 'anywhere'}}>{row.name}</Typography>
                <Typography variant="body2" fontWeight={700}>{row.records.length}</Typography>
                <Typography variant="caption" color="text.secondary"
                            sx={{width: '4ch', textAlign: 'right'}}>{percent(row.share)}</Typography>
            </Box>
            <Box sx={{
                height: 7,
                bgcolor: alpha(theme.palette.text.primary, 0.055),
                borderRadius: 1,
                ml: '26px',
                overflow: 'hidden'
            }}>
                <Box sx={{height: '100%', width: `${row.records.length / maxCount * 100}%`}}>{bars(row)}</Box>
            </Box>
        </ButtonBase>)}
        </Box>
        {rows.length > COLLAPSED_GENRE_COUNT && <Button size="small"
            aria-expanded={genresExpanded} aria-controls={genreRowsId}
            onClick={() => setGenresExpanded(expanded => !expanded)}
            endIcon={genresExpanded ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
            sx={{mt: 1, width: '100%'}}>
            {genresExpanded ? '收起' : '展开全部'}
        </Button>}
    </Box>;
}
