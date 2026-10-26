import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import {Autocomplete, Box, Button, Chip, Collapse, MenuItem, Slider, Stack, TextField, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useState} from 'react';
import type {TMDBCountry, TMDBGenre} from '../types';
import type {TMDBLanguage} from '../api/tmdb';
import {
    DEFAULT_DISCOVERY_FILTERS, DISCOVERY_SORTS, discoveryLanguageLabel, validateMovieDiscovery,
    type MovieDiscoveryFilters as Filters,
} from '../utils/movieDiscovery';

interface Props {
    initial: Filters;
    genres: TMDBGenre[];
    countries: TMDBCountry[];
    languages: TMDBLanguage[];
    onApply: (filters: Filters) => void;
}

/** 草稿与已应用条件分开，只有提交后才更新网址和请求，避免输入时频繁查询。 */
export default function MovieDiscoveryFilters({initial, genres, countries, languages, onApply}: Props) {
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<ReturnType<typeof validateMovieDiscovery>>({});
    const [more, setMore] = useState(Boolean(initial.language || initial.minVotes || initial.runtimeFrom || initial.runtimeTo));
    const change = <K extends keyof Filters>(field: K, value: Filters[K]) => {
        setDraft(current => ({...current, [field]: value}));
        setErrors({});
    };
    const ratingRange = [Number(draft.ratingFrom || 0), Number(draft.ratingTo || 10)];
    const numericField = (field: Exclude<keyof Filters, 'genres' | 'country' | 'language' | 'sort' | 'ratingFrom' | 'ratingTo'>, label: string) => (
        <TextField label={label} size="small" type="number" value={draft[field]} fullWidth
                   onChange={event => change(field, event.target.value)} error={Boolean(errors[field])}
                   helperText={errors[field]}
                   slotProps={{
                       htmlInput: {
                           min: field.startsWith('year') ? 1870 : 0,
                           max: field.startsWith('year') ? 2100 : field === 'minVotes' ? 1_000_000_000 : 1000,
                           step: 1,
                       }
                   }}/>
    );
    // 字典加载失败时也保留已选择的值，允许继续查看、删除条件或重试字典。
    const genreOptions = [...genres, ...draft.genres.filter(id => !genres.some(genre => genre.id === id))
        .map(id => ({id, name: String(id)}))];
    const countryOptions = countries.map(country => ({
        code: country.iso_3166_1,
        label: country.native_name || country.english_name || country.iso_3166_1
    }));
    if (draft.country && !countryOptions.some(option => option.code === draft.country)) {
        countryOptions.push({code: draft.country, label: draft.country});
    }
    const languageOptions = languages.map(language => ({
        code: language.iso_639_1,
        label: discoveryLanguageLabel(language.iso_639_1, language.name || language.english_name)
    }));
    if (draft.language && !languageOptions.some(option => option.code === draft.language)) {
        languageOptions.push({code: draft.language, label: discoveryLanguageLabel(draft.language)});
    }

    return <Box component="form" noValidate onSubmit={event => {
        event.preventDefault();
        const nextErrors = validateMovieDiscovery(draft);
        setErrors(nextErrors);
        if (!Object.keys(nextErrors).length) onApply(draft);
    }} sx={{display: 'flex', flexDirection: 'column', gap: 2.5}}>
        <Box component="fieldset" sx={{border: 0, p: 0, m: 0, minWidth: 0}}>
            <Typography component="legend" variant="body2" fontWeight={700} sx={{mb: 1}}>类型
                <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 1}}>匹配任一类型</Typography>
            </Typography>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
                <Chip label="全部" size="small" variant={!draft.genres.length ? 'filled' : 'outlined'}
                      color={!draft.genres.length ? 'primary' : 'default'} aria-pressed={!draft.genres.length}
                      onClick={() => change('genres', [])}/>
                {genreOptions.map(genre => {
                    const selected = draft.genres.includes(genre.id);
                    return <Chip key={genre.id} label={genre.name} size="small" aria-pressed={selected}
                                 color={selected ? 'primary' : 'default'} variant={selected ? 'filled' : 'outlined'}
                                 onClick={() => change('genres', selected ? draft.genres.filter(id => id !== genre.id) : [...draft.genres, genre.id])}/>;
                })}
            </Box>
        </Box>
        <Autocomplete size="small" options={countryOptions}
                      value={countryOptions.find(option => option.code === draft.country) ?? null}
                      onChange={(_, value) => change('country', value?.code ?? '')}
                      isOptionEqualToValue={(a, b) => a.code === b.code}
                      noOptionsText="暂无地区"
                      renderInput={params => <TextField {...params} label="制片地区" placeholder="全部地区"/>}/>
        <Box>
            <Typography variant="body2" fontWeight={700} sx={{mb: 1.5}}>上映年份</Typography>
            <Stack direction="row"
                   spacing={1}>{numericField('yearFrom', '起始年份')}{numericField('yearTo', '结束年份')}</Stack>
        </Box>
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography variant="body2" fontWeight={700}>TMDB 评分</Typography>
                <Typography variant="body2" color="primary.main" aria-live="polite"
                            sx={{fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
                    {ratingRange[0]}–{ratingRange[1]} 分
                </Typography>
            </Stack>
            <Box sx={{px: 1.25, pt: 0.5}}>
                <Slider value={ratingRange} min={0} max={10} step={1} shiftStep={1} disableSwap
                        getAriaLabel={index => index === 0 ? '最低评分' : '最高评分'}
                        getAriaValueText={value => `${value} 分`}
                        valueLabelDisplay="auto"
                        marks={Array.from({length: 11}, (_, value) => ({
                            value,
                            label: value % 5 === 0 ? String(value) : undefined,
                        }))}
                        onChange={(_, value) => {
                            if (!Array.isArray(value)) return;
                            // 两端回到完整范围时取消对应限制，避免保留无意义的筛选标签。
                            setDraft(current => ({
                                ...current,
                                ratingFrom: value[0] === 0 ? '' : String(value[0]),
                                ratingTo: value[1] === 10 ? '' : String(value[1]),
                            }));
                            setErrors({});
                        }}
                        sx={theme => ({
                            '& .MuiSlider-thumb': {
                                width: 16,
                                height: 16,
                                '&:hover, &.Mui-focusVisible': {
                                    boxShadow: `0 0 0 5px ${alpha(theme.palette.primary.main, 0.16)}`,
                                    '@media (hover: none)': {boxShadow: 'none'},
                                },
                                '&.Mui-active': {
                                    boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
                                },
                            },
                            '& .MuiSlider-markLabel': {fontSize: 12},
                        })}/>
            </Box>
        </Box>
        <TextField select size="small" label="排序" value={draft.sort}
                   onChange={event => change('sort', event.target.value)}>
            {DISCOVERY_SORTS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <Box>
            <Button size="small" color="inherit" onClick={() => setMore(value => !value)} aria-expanded={more}
                    aria-controls="discovery-more-filters"
                    endIcon={<ExpandMoreIcon sx={{transform: more ? 'rotate(180deg)' : 'none'}}/>}
                    sx={{px: 0}}>更多条件</Button>
            <Collapse in={more} id="discovery-more-filters">
                <Stack spacing={2.5} sx={{pt: 2}}>
                    <Autocomplete size="small" options={languageOptions}
                                  value={languageOptions.find(option => option.code === draft.language) ?? null}
                                  onChange={(_, value) => change('language', value?.code ?? '')}
                                  isOptionEqualToValue={(a, b) => a.code === b.code} noOptionsText="暂无语言"
                                  renderInput={params => <TextField {...params} label="原始语言" placeholder="全部语言"/>}/>
                    {numericField('minVotes', '最低评分人数')}
                    <Box>
                        <Typography variant="body2" fontWeight={700} sx={{mb: 1.5}}>片长（分钟）</Typography>
                        <Stack direction="row"
                               spacing={1}>{numericField('runtimeFrom', '最短片长')}{numericField('runtimeTo', '最大片长')}</Stack>
                    </Box>
                </Stack>
            </Collapse>
        </Box>
        <Stack direction="row" spacing={1}
               sx={{position: 'sticky', bottom: 0, bgcolor: 'background.default', py: 1.5, zIndex: 1}}>
            <Button type="submit" variant="contained" disableElevation startIcon={<SearchIcon/>}
                    sx={{flex: 1}}>应用筛选</Button>
            <Button variant="outlined" color="inherit" startIcon={<RestartAltIcon/>} onClick={() => {
                setDraft({...DEFAULT_DISCOVERY_FILTERS, genres: []});
                setErrors({});
                onApply({...DEFAULT_DISCOVERY_FILTERS, genres: []});
            }}>重置</Button>
        </Stack>
    </Box>;
}
