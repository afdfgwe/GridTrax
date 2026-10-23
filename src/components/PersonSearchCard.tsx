import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import {Box, Card, CardContent, Chip, Link, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {Fragment, useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import type {TMDBSearchResult} from '../types';

const DEPARTMENTS: Record<string, string> = {
    Acting: '演员', Directing: '导演', Writing: '编剧', Production: '制片',
    Camera: '摄影', Editing: '剪辑', Sound: '声音', Art: '美术',
    'Costume & Make-Up': '服装与化妆', 'Visual Effects': '视觉特效',
    Crew: '剧组', Lighting: '灯光', Creator: '创作者',
};

/** 人物只展示搜索接口已有资料；详情页接入前，只有代表作品提供跳转。 */
export default function PersonSearchCard({item}: {item: TMDBSearchResult}) {
    const name = item.name?.trim() || item.original_name?.trim() || '未知人物';
    const department = item.known_for_department?.trim();
    const [failedPath, setFailedPath] = useState<string>();
    const showPortrait = Boolean(item.profile_path && item.profile_path !== failedPath);
    // 只链接有效的电影和电视剧，避免异常条目被误当作电影打开。
    const works = (item.known_for ?? []).filter(work =>
        (work.media_type === 'movie' || work.media_type === 'tv') &&
        Number.isInteger(work.id) && work.id > 0 && (work.title?.trim() || work.name?.trim())
    ).filter((work, index, all) => all.findIndex(candidate =>
        candidate.id === work.id && candidate.media_type === work.media_type
    ) === index).slice(0, 3);

    return (
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper'}}>
            <Box sx={{position: 'relative', aspectRatio: '2/3', overflow: 'hidden', bgcolor: 'action.hover'}}>
                {showPortrait ? (
                    <Box component="img" loading="lazy" src={getPosterUrl(item.profile_path!, 'w342')}
                         alt={name} onError={() => setFailedPath(item.profile_path ?? undefined)}
                         sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                ) : (
                    <Box role="img" aria-label={`${name}暂无头像`}
                         sx={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <PersonOutlineIcon sx={{fontSize: 64, color: 'text.disabled'}}/>
                    </Box>
                )}
                <Chip label="人物" size="small" sx={{
                    position: 'absolute', top: 8, left: 8,
                    bgcolor: alpha('#FFE082', 0.9), color: '#000', fontWeight: 700, fontSize: '0.65rem',
                }}/>
            </Box>
            <CardContent sx={{flex: 1, minWidth: 0, pb: '12px !important'}}>
                <Typography variant="body2" fontWeight={700} noWrap title={name}>{name}</Typography>
                {department && <Typography variant="caption" color="text.secondary" component="div" noWrap
                                           title={DEPARTMENTS[department] ?? department}>
                    {DEPARTMENTS[department] ?? department}
                </Typography>}
                {works.length > 0 && <Typography component="div" variant="caption" color="text.secondary"
                                                sx={{mt: 1, lineHeight: 1.6, overflowWrap: 'anywhere'}}>
                    {works.map((work, index) => {
                        const title = work.title?.trim() || work.name!.trim();
                        return <Fragment key={`${work.media_type}-${work.id}`}>
                            {index > 0 && '，'}
                            <Link component={RouterLink}
                                     to={`/${work.media_type}/${work.id}`} title={title} underline="hover"
                                     sx={{fontSize: 'inherit', lineHeight: 'inherit'}}>
                                {title}
                            </Link>
                        </Fragment>;
                    })}
                </Typography>}
            </CardContent>
        </Card>
    );
}
