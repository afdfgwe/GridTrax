import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import {Alert, Box, Button, Container, IconButton, Link, Skeleton, Tooltip, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useCallback, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getPerson, getPosterUrl} from '../api/tmdb';
import ExpandableOverview from '../components/ExpandableOverview';
import PersonFilmography from '../components/PersonFilmography';
import {useAsyncResource} from '../hooks/useAsyncResource';
import {getPersonProfile} from '../utils/personProfile';

/** 人物肖像保持固定比例；空头像或图片加载失败不影响资料展示。 */
function Portrait({path, name}: { path?: string | null; name: string }) {
    const [failed, setFailed] = useState(false);
    return <Box sx={{
        aspectRatio: '2/3', overflow: 'hidden', borderRadius: '8px', bgcolor: 'action.hover',
        border: 1, borderColor: 'divider', boxShadow: theme => `0 12px 32px ${alpha(theme.palette.common.black, 0.12)}`
    }}>
        {path && !failed ? <Box component="img" src={getPosterUrl(path, 'h632')} alt={name}
                                onError={() => setFailed(true)}
                                sx={{display: 'block', height: '100%', width: '100%', objectFit: 'cover'}}/>
            : <Box role="img" aria-label={`${name}暂无头像`}
                   sx={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <PersonOutlineIcon sx={{fontSize: 72, color: 'text.disabled'}}/>
            </Box>}
    </Box>;
}

/** 人物资料和影视履历均为只读展示，不调用观影进度仓库。 */
export default function PersonDetailPage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const personId = Number(id);
    const validId = Number.isSafeInteger(personId) && personId > 0;
    const load = useCallback(() => getPerson(personId), [personId]);
    const {data: person, loading, error, retry} = useAsyncResource(`person:${id}`, load);
    const profile = person ? getPersonProfile(person) : undefined;
    // 直接打开详情链接时也能返回站内；由搜索页进入时保留原关键词和页码。
    const goBack = () => window.history.state?.idx > 0 ? navigate(-1) : navigate('/search');

    return <Container maxWidth="lg" sx={{pt: {xs: 1, sm: 2}, pb: 3}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: {xs: 2.5, sm: 4}}}>
            <Tooltip title="返回"><IconButton onClick={goBack} aria-label="返回上一页" size="small">
                <ArrowBackIcon fontSize="small"/>
            </IconButton></Tooltip>
            <Typography variant="body2" color="text.secondary">人物资料</Typography>
        </Box>

        {error && <Alert severity="error"
                         action={validId && <Button color="inherit" size="small" onClick={retry}>重试</Button>}>
            {validId ? error : '人物编号无效，请从搜索结果重新进入。'}
        </Alert>}

        {loading && <Box aria-label="正在加载人物资料" sx={{
            display: 'grid', gap: {xs: 2.5, sm: 4},
            gridTemplateColumns: {xs: '112px minmax(0, 1fr)', sm: '220px minmax(0, 1fr)'}
        }}>
            <Skeleton variant="rounded" sx={{width: '100%', height: 'auto', aspectRatio: '2/3'}}/>
            <Box sx={{minWidth: 0}}>
                <Skeleton width="70%" height={48}/><Skeleton width="35%" height={28}/>
                <Skeleton width="85%" height={28}/><Skeleton width="65%" height={28}/>
            </Box>
            <Box sx={{gridColumn: '1 / -1', mt: 2}}>
                <Skeleton width={100} height={32}/><Skeleton/><Skeleton/><Skeleton width="75%"/>
            </Box>
        </Box>}

        {profile && person && <>
            <Box component="section" aria-labelledby="person-name" sx={{
                display: 'grid',
                gridTemplateColumns: {xs: '112px minmax(0, 1fr)', sm: '220px minmax(0, 1fr)'},
                columnGap: {xs: 2.5, sm: 4.5}, rowGap: {xs: 3, sm: 2}, alignItems: 'start',
                pb: {xs: 3, sm: 4}, borderBottom: 1, borderColor: 'divider'
            }}>
                <Box sx={{gridRow: {sm: '1 / span 2'}}}>
                    <Portrait key={`${person.id}:${person.profile_path}`} path={person.profile_path}
                              name={profile.name}/>
                </Box>
                <Box sx={{minWidth: 0, alignSelf: {xs: 'center', sm: 'start'}}}>
                    {profile.department && <Typography variant="body2" color="primary.main"
                                                       sx={{fontWeight: 600, mb: 0.75, overflowWrap: 'anywhere'}}>
                        {profile.department}
                    </Typography>}
                    <Typography id="person-name" component="h1" sx={{
                        fontSize: {xs: '1.75rem', sm: '2.5rem'},
                        fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere'
                    }}>{profile.name}</Typography>
                    {profile.links.length > 0 && <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2}}>
                        {profile.links.map(link => <Link key={link.label} href={link.href} target="_blank"
                                                         rel="noopener noreferrer" underline="hover" sx={{
                            display: 'inline-flex', alignItems: 'center',
                            gap: 0.5, fontSize: '0.75rem', fontWeight: 600
                        }}>
                            {link.label}<OpenInNewIcon sx={{fontSize: 13}}/>
                        </Link>)}
                    </Box>}
                </Box>
                {(profile.facts.length > 0 || profile.aliases.length > 0) && <Box sx={{
                    gridColumn: {xs: '1 / -1', sm: 2}, minWidth: 0
                }}>
                    <Box component="dl" sx={{
                        m: 0, display: 'grid', gap: 2,
                        gridTemplateColumns: {xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))'}
                    }}>
                        {profile.facts.map(fact => <Box key={fact.label} sx={{
                            minWidth: 0,
                            ...(fact.label === '出生地' ? {gridColumn: {xs: '1 / -1', md: 'auto'}} : {})
                        }}>
                            <Typography component="dt" variant="caption" color="text.secondary" sx={{mb: 0.5}}>
                                {fact.label}
                            </Typography>
                            <Typography component="dd" variant="body2" sx={{
                                m: 0, fontWeight: 500,
                                overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums'
                            }}>{fact.value}</Typography>
                        </Box>)}
                        {profile.aliases.length > 0 && <Box sx={{gridColumn: '1 / -1', minWidth: 0}}>
                            <Typography component="dt" variant="caption" color="text.secondary"
                                        sx={{mb: 0.5}}>又名</Typography>
                            <Box component="dd" sx={{m: 0, '& p': {color: 'text.primary', lineHeight: 1.8}}}>
                                <ExpandableOverview key={person.id} text={profile.aliases.join('、')}
                                                    collapsedLines={4} collapseLabel="收起"/>
                            </Box>
                        </Box>}
                    </Box>
                </Box>}
            </Box>
            {profile.biography && <Box component="section" aria-labelledby="person-biography"
                                       sx={{pt: {xs: 3, sm: 4}, maxWidth: '80ch'}}>
                <Typography id="person-biography" component="h2" variant="h6" sx={{mb: 1.5}}>人物简介</Typography>
                <ExpandableOverview key={person.id} text={profile.biography} collapsedLines={10} indentFirstLine/>
            </Box>}
        </>}
        {validId && !error && <PersonFilmography key={personId} personId={personId}/>}
    </Container>;
}
