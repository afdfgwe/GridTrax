import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import {
    Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Skeleton,
    ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import {useCallback, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {getPersonCombinedCredits, getPosterUrl} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {groupPersonWorks, type PersonWork} from '../utils/personCredits';
import PosterScoreBadge from './PosterScoreBadge';

/** 海报和文字共享一个详情链接；角色与职务完整换行，不挤占固定的海报空间。 */
function WorkRow({work}: { work: PersonWork }) {
    const [failed, setFailed] = useState(false);
    return <Box component={Link} to={`/${work.mediaType}/${work.id}`} aria-label={`查看${work.title}详情`}
                sx={{
                    display: 'flex', gap: 1.5, minWidth: 0, py: 1.75, px: 0.5,
                    textDecoration: 'none', color: 'text.primary',
                    borderRadius: 1, transition: 'background-color 150ms',
                    '&:hover': {bgcolor: 'action.hover'},
                    '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2},
                    '@media (prefers-reduced-motion: reduce)': {transition: 'none'}
                }}>
        <Box sx={{
            width: {xs: 56, sm: 64}, aspectRatio: '2/3', alignSelf: 'flex-start', flexShrink: 0,
            position: 'relative', borderRadius: '6px', overflow: 'hidden', bgcolor: 'action.hover'
        }}>
            <Box component="img" src={failed ? '/placeholder-poster.svg' : getPosterUrl(work.posterPath, 'w185')}
                 alt={work.title} loading="lazy" decoding="async" onError={() => setFailed(true)}
                 sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
            <PosterScoreBadge score={work.score}/>
        </Box>
        <Box sx={{minWidth: 0, flex: 1}}>
            <Typography component="h4" variant="body2" sx={{
                fontWeight: 700, lineHeight: 1.5,
                overflowWrap: 'anywhere', mb: 0.5
            }}>{work.title}</Typography>
            <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25, mb: 0.75}}>
                <Typography component="span" variant="caption" color="text.secondary" sx={{
                    display: 'inline-flex',
                    alignItems: 'center', gap: 0.5
                }}>
                    {work.mediaType === 'movie' ? <MovieOutlinedIcon sx={{fontSize: 13}}/>
                        : <TvOutlinedIcon sx={{fontSize: 13}}/>}
                    {work.mediaType === 'movie' ? '电影' : '电视剧'}
                </Typography>
                {work.date && <Typography component="time" dateTime={work.date} variant="caption"
                                          color="text.secondary">{work.date}</Typography>}
            </Box>
            {work.cast && <Typography variant="body2" sx={{
                fontSize: '0.8125rem', lineHeight: 1.65,
                overflowWrap: 'anywhere'
            }}>
                <Box component="span"
                     sx={{color: 'text.secondary', mr: 0.75}}>{work.characters.length ? '饰演' : '出演'}</Box>
                {work.characters.join('、')}
            </Typography>}
            {work.jobs.length > 0 && <Typography variant="body2" sx={{
                fontSize: '0.8125rem', lineHeight: 1.65,
                overflowWrap: 'anywhere'
            }}>
                <Box component="span" sx={{color: 'text.secondary', mr: 0.75}}>幕后</Box>{work.jobs.join('、')}
            </Typography>}
        </Box>
    </Box>;
}

/** 履历与人物资料并行请求，按年份组织作品，所有筛选只在内存执行。 */
export default function PersonFilmography({personId}: { personId: number }) {
    const load = useCallback(() => getPersonCombinedCredits(personId), [personId]);
    const {data, loading, error, retry} = useAsyncResource(`person-credits:${personId}`, load);
    const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
    const [job, setJob] = useState('');
    const [year, setYear] = useState('');
    const groups = useMemo(() => groupPersonWorks(data ?? [], {mediaType, job, year}), [data, mediaType, job, year]);
    const availableYears = useMemo(() => groupPersonWorks(data ?? [], {mediaType, job})
        .map(group => group.year), [data, mediaType, job]);
    const jobs = useMemo(() => {
        const works = (data ?? []).filter(work => mediaType === 'all' || work.mediaType === mediaType);
        return [...(works.some(work => work.cast) ? ['出演'] : []),
            ...new Set(works.flatMap(work => work.jobs))];
    }, [data, mediaType]);
    const count = groups.reduce((total, group) => total + group.works.length, 0);

    return <Box component="section" aria-labelledby="person-filmography" aria-busy={loading}
                sx={{mt: {xs: 3, sm: 4}, pt: {xs: 2.5, sm: 3}, borderTop: 1, borderColor: 'divider', minWidth: 0}}>
        <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2}}>
            <Typography id="person-filmography" component="h2" variant="h6" fontWeight={700}>影视作品</Typography>
            {data && !loading && !error && <Typography variant="caption" color="text.secondary"
                                                       aria-live="polite">{count} 部</Typography>}
        </Box>
        {loading ? <Box aria-label="正在加载影视作品" sx={{
            display: 'grid',
            gridTemplateColumns: {xs: '1fr', md: '1fr 1fr'}, gap: 2
        }}>
            {Array.from({length: 4}, (_, index) => <Box key={index} sx={{display: 'flex', gap: 1.5}}>
                <Skeleton variant="rounded" width={56} height={84} sx={{flexShrink: 0}}/>
                <Box sx={{flex: 1}}><Skeleton width="70%"/><Skeleton width="40%"/><Skeleton width="85%"/></Box>
            </Box>)}
        </Box> : error ?
            <Alert severity="warning" action={<Button color="inherit" size="small" onClick={retry}>重试</Button>}>
                影视作品加载失败：{error}
            </Alert> : !data?.length ? <Typography variant="body2" color="text.secondary">暂无影视作品</Typography> : <>
                <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25, pb: 2.5}}>
                    <ToggleButtonGroup size="small" exclusive value={mediaType} aria-label="作品类型"
                                       onChange={(_, value: 'all' | 'movie' | 'tv' | null) => {
                                           if (value) {
                                               setMediaType(value);
                                               setJob('');
                                               setYear('');
                                           }
                                       }} sx={{
                        height: 34, flexShrink: 0, mr: {sm: 'auto'},
                        '& .MuiToggleButton-root': {px: 1.5, py: 0.5, fontSize: '0.8125rem', lineHeight: 1.5}
                    }}>
                        <ToggleButton value="all">全部</ToggleButton>
                        <ToggleButton value="movie">电影</ToggleButton>
                        <ToggleButton value="tv">电视剧</ToggleButton>
                    </ToggleButtonGroup>
                    <Box sx={{display: 'flex', gap: 1.25, width: {xs: '100%', sm: 'auto'}}}>
                        <FormControl size="small" sx={{flex: {xs: 1, sm: 'none'}, minWidth: 120}}>
                            <InputLabel id="person-work-job-label" shrink>职务</InputLabel>
                            <Select labelId="person-work-job-label" label="职务" value={job} displayEmpty
                                    onChange={event => {
                                        setJob(event.target.value);
                                        setYear('');
                                    }}
                                    sx={{height: 34, fontSize: '0.8125rem'}}>
                                <MenuItem value="">全部职务</MenuItem>
                                {jobs.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{flex: {xs: 1, sm: 'none'}, minWidth: 120}}>
                            <InputLabel id="person-work-year-label" shrink>年份</InputLabel>
                            <Select labelId="person-work-year-label" label="年份" value={year} displayEmpty
                                    onChange={event => setYear(event.target.value)}
                                    sx={{height: 34, fontSize: '0.8125rem'}}>
                                <MenuItem value="">全部年份</MenuItem>
                                {availableYears.map(value => <MenuItem key={value || 'unknown'}
                                                                       value={value || 'unknown'}>
                                    {value || '年份未知'}
                                </MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>
                {groups.length === 0 ? <Typography variant="body2" color="text.secondary">暂无符合条件的作品</Typography>
                    : groups.map(group => <Box component="section" key={group.year || 'unknown'}
                                               aria-label={group.year ? `${group.year}年作品` : '年份未知作品'} sx={{
                        display: 'grid', gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: '100px minmax(0, 1fr)'},
                        columnGap: 3, pt: 1.5, pb: 1.5,
                        '& + section': {borderTop: 1, borderColor: 'divider'}
                    }}>
                        <Box sx={{
                            display: 'flex', alignItems: 'baseline', gap: 1, pt: {xs: 0, md: 1.5},
                            mb: {xs: 0.5, md: 0}, flexWrap: 'wrap', alignContent: 'flex-start'
                        }}>
                            <Typography component="h3" sx={{
                                fontSize: group.year ? '1.5rem' : '0.875rem',
                                fontWeight: 800,
                                lineHeight: 1.25,
                                color: 'primary.main',
                                fontVariantNumeric: 'tabular-nums'
                            }}>
                                {group.year || '年份未知'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{group.works.length} 部</Typography>
                        </Box>
                        <Box component="ul" sx={{
                            m: 0, p: 0, listStyle: 'none', display: 'grid',
                            gridTemplateColumns: {xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'},
                            columnGap: 3, alignItems: 'start'
                        }}>
                            {group.works.map(work => <Box component="li" key={work.key} sx={{minWidth: 0}}>
                                <WorkRow work={work}/>
                            </Box>)}
                        </Box>
                    </Box>)}
            </>}
    </Box>;
}
