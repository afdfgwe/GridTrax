import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import {Box, Skeleton, Typography} from '@mui/material';
import {darken, lighten} from '@mui/material/styles';
import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import ExpandableOverview from './ExpandableOverview';
import type {HotCategory, HotRow, HotSource} from '../types/hotMovies';
import type {TMDBCountry, TMDBGenre} from '../types';
import {parseHotMovieInfo} from '../utils/hotMovieInfo';
import {getTrendingInfo, getTrendingPersonWorks} from '../utils/trendingMovies';
import {getPersonDepartment} from '../utils/personProfile';

/** 两个榜单来源使用不同的数据适配器，最终统一成“标签 + 内容”的展示结构。 */
function HotInfo({
                     row,
                     source,
                     genres,
                     countries
                 }: { row: HotRow; source: HotSource; genres: TMDBGenre[]; countries: TMDBCountry[] }) {
    const parts = source === 'tmdb' ? getTrendingInfo(row.movie, genres, countries) : parseHotMovieInfo(row.item.info);
    if (!parts.length) return null;
    return (
        <Box component="dl" sx={{display: 'grid', rowGap: 0.375, m: 0, mt: 1}}>
            {parts.map(({label, value}) => <Box component="div" key={label}
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'max-content minmax(0, 1fr)',
                                                    columnGap: 0.75,
                                                    alignItems: 'baseline',
                                                    minWidth: 0
                                                }}>
                <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                <Typography component="dd" variant="body2" sx={{
                    m: 0, minWidth: 0, overflowWrap: 'anywhere',
                    color: theme => theme.palette.mode === 'light'
                        ? darken(theme.palette.text.primary, 0.12)
                        : lighten(theme.palette.text.primary, 0.12)
                }}>
                    {value}
                </Typography>
            </Box>)}
        </Box>
    );
}

// 两个来源的评分独立判断，不能把某一来源的分数当成另一来源的缺省值。
function Scores({row}: { row: HotRow }) {
    const {item, movie} = row;
    const douban = typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0;
    const tmdb = typeof movie?.vote_average === 'number' && Number.isFinite(movie.vote_average) && movie.vote_average > 0;
    if (!douban && !tmdb) return null;
    return (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: {xs: 1.5, sm: 2.5}, alignItems: 'baseline', mt: 0.75}}>
            {douban && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">豆瓣</Typography>
                <Typography component="span" sx={{
                    fontSize: 20, lineHeight: 1.2, fontWeight: 800,
                    color: 'warning.main', fontVariantNumeric: 'tabular-nums'
                }}>{item.rating!.toFixed(1)}</Typography>
            </Box>}
            {tmdb && <Box sx={{display: 'inline-flex', alignItems: 'baseline', gap: 0.5}}>
                <Typography variant="caption" color="text.secondary">TMDB</Typography>
                <Typography component="span" sx={{
                    fontSize: 20, lineHeight: 1.2, fontWeight: 800,
                    color: 'primary.main', fontVariantNumeric: 'tabular-nums'
                }}>{movie!.vote_average!.toFixed(1)}</Typography>
            </Box>}
        </Box>
    );
}

/** 热门榜与影视列表共用条目排版，保持详情链接与缺失资料的处理一致。 */
export default function RankingRow({
                                       row,
                                       kind,
                                       source,
                                       genres,
                                       countries
                                   }: { row: HotRow; kind: HotCategory; source: HotSource; genres: TMDBGenre[]; countries: TMDBCountry[] }) {
    const {item, movie, person, status} = row;
    // 匹配结束后仍无 TMDB 资料时，使用豆瓣条目编号打开原始详情；加载中保留站内搜索。
    const openDouban = source === 'douban' && !movie && (status === 'unmatched' || status === 'error');
    const linkProps = {
        to: person ? `/person/${person.id}` : movie ? `/${kind}/${movie.id}` : openDouban
            ? `https://movie.douban.com/subject/${encodeURIComponent(item.id)}/`
            : `/search?q=${encodeURIComponent(item.title)}`,
        target: openDouban ? '_blank' : undefined,
        rel: openDouban ? 'noopener noreferrer' : undefined,
        'aria-label': openDouban ? `在豆瓣查看${item.title}详情（新标签页打开）`
            : person || movie ? `查看${item.title}详情` : `搜索${item.title}`,
    };
    // 缺少海报时仍保留图片列，由 getPosterUrl 提供与详情页相同的占位图。
    const imagePath = person ? person.profile_path : movie?.poster_path;
    const originalTitle = person ? (person.original_name?.trim() !== item.title ? person.original_name?.trim() : undefined)
        : source === 'tmdb' ? movie?.original_title?.trim() : undefined;
    const department = person ? getPersonDepartment(person.known_for_department) : '';
    const works = person ? getTrendingPersonWorks(person) : [];
    const overview = person ? undefined : source === 'tmdb' ? movie?.overview?.trim() : status === 'error' ? 'TMDB 资料加载失败' :
        status === 'unmatched' ? '暂未匹配到 TMDB 影片' : movie?.overview || '暂无简介';
    return (
        <Box component="li" sx={{
            minWidth: 0, borderBottom: 1, borderColor: 'divider', display: 'grid',
            gridTemplateColumns: person ? {xs: '64px minmax(0, 1fr)', sm: '72px minmax(0, 1fr)'} : {
                xs: '96px minmax(0, 1fr)',
                sm: '140px minmax(0, 1fr)'
            },
            columnGap: person ? 1.5 : {xs: 2, sm: 3}, rowGap: person ? 0 : 1.5,
            py: person ? 1.75 : {xs: 2.5, sm: 3}, px: person ? 0 : {xs: 0, sm: 1},
            ...(!person && {'&:first-of-type': {pt: {xs: 1.5, sm: 2}}})
        }}>
            <Box component={Link} {...linkProps}
                     sx={{
                         position: 'relative',
                         width: '100%',
                         aspectRatio: '2 / 3',
                         alignSelf: 'start',
                         gridRow: person ? 'auto' : {sm: '1 / span 2'},
                         overflow: 'hidden',
                         borderRadius: 1.5,
                         bgcolor: 'action.hover',
                         '&:hover img': {transform: 'scale(1.035)'},
                         '@media (prefers-reduced-motion: reduce)': {'& img': {transition: 'none'}}
                     }}>
                    {status === 'loading' ?
                        <Skeleton variant="rectangular" width="100%" height="100%"/> : person && !imagePath ?
                            <Box role="img" aria-label={`${item.title}暂无头像`} sx={{
                                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}><PersonOutlineIcon sx={{fontSize: 32, color: 'text.disabled'}}/></Box> :
                            // 前三名通常位于首屏，优先加载海报，其余懒加载。
                            <Box component="img" src={getPosterUrl(imagePath ?? undefined)} alt=""
                                 loading={item.rank <= 3 ? 'eager' : 'lazy'}
                                 onError={event => {
                                     event.currentTarget.onerror = null;
                                     event.currentTarget.src = '/placeholder-poster.svg';
                                 }}
                                 sx={{
                                     display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                                     transition: 'transform 250ms ease'
                                 }}/>}
                    <Box aria-hidden="true" sx={{
                        position: 'absolute', left: 0, top: 0, px: person ? 0.625 : 1, py: 0.25,
                        bgcolor: item.rank <= 3 ? 'primary.main' : 'rgba(12, 18, 22, 0.88)',
                        color: item.rank <= 3 ? 'primary.contrastText' : '#fff',
                        fontSize: person ? 12 : 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums'
                    }}>
                        {String(item.rank).padStart(2, '0')}
                    </Box>
                </Box>
            <Box sx={{minWidth: 0}}>
                <Typography component="h2" sx={{
                    fontWeight: 750, fontSize: person ? {xs: 17, sm: 18} : {xs: 18, sm: 23}, lineHeight: 1.35,
                    overflowWrap: 'anywhere'
                }}>
                    <Box component={Link} {...linkProps} sx={{
                        color: 'text.primary', textDecoration: 'none',
                        '&:hover, &:focus-visible': {color: 'primary.main', textDecoration: 'underline'}
                    }}>
                        {item.title}
                    </Box>
                    {department && <Typography component="span" color="text.secondary"
                                               sx={{ml: 1, fontSize: 13, fontWeight: 400}}>{department}</Typography>}
                    {item.year && <Typography component="span" color="text.secondary"
                                              sx={{
                                                  display: 'inline-block', ml: 0.75, fontSize: {xs: 14, sm: 16},
                                                  fontWeight: 400, whiteSpace: 'nowrap'
                                              }}>({item.year})</Typography>}
                </Typography>
                {originalTitle && <Typography color="text.secondary"
                                              sx={{
                                                  mt: 0.375,
                                                  fontWeight: 750,
                                                  fontSize: person ? 13 : {xs: 14, sm: 16},
                                                  lineHeight: 1.4,
                                                  overflowWrap: 'anywhere'
                                              }}>
                    {originalTitle}
                </Typography>}
                {person ? works.length > 0 && <Typography component="div" variant="body2" color="text.secondary"
                                                          sx={{
                                                              mt: 0.5,
                                                              fontSize: 13,
                                                              lineHeight: 1.6,
                                                              overflowWrap: 'anywhere'
                                                          }}>
                    {works.map((work, index) => <Fragment key={`${work.kind}-${work.id}`}>
                        {index > 0 && '，'}
                        <Box component={Link} to={`/${work.kind}/${work.id}`} sx={{
                            color: 'text.primary', textDecoration: 'none',
                            '&:hover, &:focus-visible': {color: 'primary.main', textDecoration: 'underline'}
                        }}>{work.title}</Box>
                    </Fragment>)}
                </Typography> : <>
                    <HotInfo row={row} source={source} genres={genres} countries={countries}/>
                    <Scores row={row}/>
                </>}
                {status === 'loading' &&
                    <Box sx={{mt: 2}} aria-label="正在匹配 TMDB"><Skeleton/><Skeleton width="75%"/></Box>}
            </Box>
            {status !== 'loading' && overview && <Box sx={{gridColumn: {xs: '1 / -1', sm: '2'}}}>
                <ExpandableOverview text={overview} collapsedLines={4}/>
            </Box>}
        </Box>
    );
}

