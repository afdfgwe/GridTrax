import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import {
    Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Skeleton,
    Tab, Tabs, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useCallback, useEffect, useRef, useState} from 'react';
import {getMovieCredits, getPosterUrl, getTVAggregateCredits} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import type {TMDBCastMember, TMDBCreditPerson} from '../types';
import {getCrewGroups, getOrderedCast, MAIN_CREW_LABELS} from '../utils/movieCredits';
import type {CrewGroup} from '../utils/movieCredits';

/** 固定照片比例，加载失败时保留原占位尺寸，不改变人物列表布局。 */
function PersonPortrait({person}: {person: TMDBCreditPerson}) {
    const [failed, setFailed] = useState(false);
    return (
        <Box sx={{aspectRatio: '2 / 3', width: '100%', overflow: 'hidden', borderRadius: 1,
            bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            {person.profile_path && !failed ? (
                <Box component="img" src={getPosterUrl(person.profile_path, 'w185')} alt={person.name}
                     loading="lazy" decoding="async" onError={() => setFailed(true)}
                     sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
            ) : <PersonOutlineIcon aria-hidden="true" sx={{fontSize: 36, color: 'text.disabled'}}/>}
        </Box>
    );
}

function ActorItem({person, fullText = false}: {person: TMDBCastMember; fullText?: boolean}) {
    return (
        <Box component="li" sx={{listStyle: 'none', minWidth: 0}}>
            <PersonPortrait key={person.profile_path} person={person}/>
            <Typography title={person.name} sx={{fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.5,
                mt: 0.75, minHeight: '1.5em',
                ...(fullText ? {whiteSpace: 'normal', overflowWrap: 'anywhere'} :
                    {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'})}}>
                {person.name}
            </Typography>
            <Typography title={person.character || undefined} color="text.secondary"
                        sx={{fontSize: '0.75rem', lineHeight: 1.5, minHeight: '1.5em',
                            ...(fullText ? {whiteSpace: 'normal', overflowWrap: 'anywhere'} :
                                {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'})}}>
                {person.character ? `饰 ${person.character}` : ''}
            </Typography>
        </Box>
    );
}

function CreditsDialog({cast, crew, onClose}: {cast: TMDBCastMember[]; crew: CrewGroup[]; onClose: () => void}) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [tab, setTab] = useState(cast.length ? 'cast' : 'crew');
    const contentRef = useRef<HTMLDivElement>(null);
    return (
        <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md"
                aria-labelledby="media-credits-title" slotProps={{paper: {sx: {borderRadius: fullScreen ? 0 : 2}}}}>
            <DialogTitle id="media-credits-title" sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                pt: fullScreen ? 'max(16px, env(safe-area-inset-top))' : 2}}>
                <Typography component="span" fontWeight={700}>演职人员</Typography>
                <Tooltip title="关闭"><IconButton aria-label="关闭演职人员" onClick={onClose}><CloseIcon/></IconButton></Tooltip>
            </DialogTitle>
            <Tabs value={tab} onChange={(_, value: string) => {
                setTab(value);
                contentRef.current?.scrollTo({top: 0});
            }} aria-label="演职人员分类" sx={{px: {xs: 2, sm: 3}, borderBottom: 1, borderColor: 'divider', flexShrink: 0}}>
                <Tab value="cast" id="credits-cast-tab" aria-controls="credits-cast-panel" label={`演员（${cast.length}）`}/>
                <Tab value="crew" id="credits-crew-tab" aria-controls="credits-crew-panel" label="幕后"/>
            </Tabs>
            <DialogContent ref={contentRef} sx={{py: 2.5, pb: 'max(24px, env(safe-area-inset-bottom))'}}>
                <Box role="tabpanel" id={`credits-${tab}-panel`} aria-labelledby={`credits-${tab}-tab`}>
                    {tab === 'cast' ? (cast.length ? (
                        <Box component="ul" sx={{display: 'grid', gridTemplateColumns: {xs: 'repeat(3, minmax(0, 1fr))',
                            sm: 'repeat(5, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))'}, gap: {xs: 1.5, sm: 2}, m: 0, p: 0}}>
                            {cast.map(person => <ActorItem key={person.id} person={person} fullText/>)}
                        </Box>
                    ) : <Typography color="text.secondary">暂无演员信息</Typography>) : (
                        crew.length ? crew.map(group => (
                            <Box key={group.label} sx={{mb: 3, '&:last-child': {mb: 0}}}>
                                <Typography component="h3" variant="subtitle2" sx={{mb: 1.5}}>{group.label}</Typography>
                                <Box component="ul" sx={{display: 'grid', gridTemplateColumns: {xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))'}, gap: 1.5, p: 0, m: 0}}>
                                    {group.members.map(person => (
                                        <Box component="li" key={person.id} sx={{display: 'flex', gap: 1.25, alignItems: 'center', listStyle: 'none', minWidth: 0}}>
                                            <Box sx={{width: 44, flexShrink: 0}}><PersonPortrait key={person.profile_path} person={person}/></Box>
                                            <Typography variant="body2" sx={{overflowWrap: 'anywhere'}}>{person.name}</Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )) : <Typography color="text.secondary">暂无幕后信息</Typography>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
}

/** 电影和整剧共用演职员布局，独立加载，不影响简介、集数或本地观看状态。 */
export default function MediaCredits({mediaId, mediaType}: {mediaId: number; mediaType: 'movie' | 'tv'}) {
    const load = useCallback(() => mediaType === 'tv' ? getTVAggregateCredits(mediaId) : getMovieCredits(mediaId), [mediaId, mediaType]);
    const {data, loading, error, retry} = useAsyncResource(`${mediaType}-credits:${mediaId}`, load);
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const [scroll, setScroll] = useState({previous: false, next: false});
    const cast = getOrderedCast(data?.cast);
    const crew = getCrewGroups(data?.crew);
    const mainCrew = crew.filter(group => MAIN_CREW_LABELS.some(label => label === group.label));
    const updateScroll = useCallback(() => {
        const element = listRef.current;
        if (element) setScroll({previous: element.scrollLeft > 1,
            next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1});
    }, []);

    useEffect(() => {
        const element = listRef.current;
        if (!element) return;
        const observer = new ResizeObserver(updateScroll);
        observer.observe(element);
        if (element.firstElementChild) observer.observe(element.firstElementChild);
        return () => observer.disconnect();
    }, [data, updateScroll]);

    const move = (direction: number) => {
        const element = listRef.current;
        element?.scrollBy({left: direction * element.clientWidth * 0.8,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    };

    if (!loading && !error && !cast.length && !crew.length) return null;

    return (
        <Box component="section" aria-labelledby="media-credits-heading" sx={{mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider', minWidth: 0}}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2}}>
                <Typography id="media-credits-heading" component="h2" variant="h6" fontWeight={700}>演职人员</Typography>
                {!loading && !error && <Button size="small" color="inherit" endIcon={<ChevronRightIcon/>} onClick={() => setOpen(true)}
                    sx={{flexShrink: 0, color: 'text.secondary'}}>查看全部</Button>}
            </Box>
            {loading ? (
                <Box aria-label="正在加载演职人员" sx={{display: 'flex', gap: 1.5, overflow: 'hidden'}}>
                    {Array.from({length: 6}, (_, index) => <Skeleton key={index} variant="rounded" sx={{width: {xs: 80, sm: 96}, height: {xs: 160, sm: 190}, flexShrink: 0, borderRadius: 1}}/>)}
                </Box>
            ) : error ? (
                <Alert severity="warning" action={<Button color="inherit" size="small" onClick={retry}>重试</Button>}>演职人员加载失败：{error}</Alert>
            ) : (
                <>
                    {!!mainCrew.length && <Box component="dl" sx={{m: 0, mb: cast.length ? 2.5 : 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 1.5, rowGap: 0.75}}>
                        {mainCrew.flatMap(group => [
                            <Typography component="dt" key={`${group.label}:label`} variant="body2" color="text.secondary">{group.label}</Typography>,
                            <Typography component="dd" key={`${group.label}:names`} variant="body2" sx={{m: 0, overflowWrap: 'anywhere'}}>{group.members.map(person => person.name).join('、')}</Typography>,
                        ])}
                    </Box>}
                    {!!cast.length && <>
                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25, minHeight: 32}}>
                            <Typography component="h3" variant="subtitle2" color="text.secondary">主要演员</Typography>
                            {(scroll.previous || scroll.next) && <Box sx={{display: {xs: 'none', sm: 'flex'}, gap: 0.5}}>
                                <Tooltip title="向左查看演员"><span><IconButton size="small" aria-label="向左查看演员" disabled={!scroll.previous} onClick={() => move(-1)}><ChevronLeftIcon fontSize="small"/></IconButton></span></Tooltip>
                                <Tooltip title="向右查看演员"><span><IconButton size="small" aria-label="向右查看演员" disabled={!scroll.next} onClick={() => move(1)}><ChevronRightIcon fontSize="small"/></IconButton></span></Tooltip>
                            </Box>}
                        </Box>
                        <Box ref={listRef} onScroll={updateScroll} tabIndex={0} role="region" aria-label="主要演员列表"
                             sx={{overflowX: 'auto', overscrollBehaviorX: 'contain', scrollbarWidth: 'thin', pb: 1,
                                 '&:focus-visible': {outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3}}}>
                            <Box component="ul" sx={{display: 'flex', gap: 1.5, width: 'max-content', m: 0, p: 0,
                                '& > li': {width: {xs: 80, sm: 96}, flexShrink: 0}}}>
                                {cast.slice(0, 10).map(person => <ActorItem key={person.id} person={person}/>)}
                            </Box>
                        </Box>
                    </>}
                </>
            )}
            {open && <CreditsDialog cast={cast} crew={crew} onClose={() => setOpen(false)}/>}
        </Box>
    );
}
