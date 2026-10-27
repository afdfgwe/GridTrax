import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import StarIcon from '@mui/icons-material/Star';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    Chip,
    Container,
    IconButton,
    Skeleton,
    Typography,
} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useCallback, useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getBackdropUrl, getPosterUrl, getTVShow} from '../api/tmdb';
import SeasonBlock from '../components/SeasonBlock';
import ExpandableOverview from '../components/ExpandableOverview';
import ProductionInfo from '../components/ProductionInfo';
import MediaCredits from '../components/MediaCredits';
import MediaImageGallery from '../components/MediaImageGallery';
import MediaRecommendations from '../components/MediaRecommendations';
import {useProgressStore} from '../store/useProgressStore';
import {useAsyncResource} from '../hooks/useAsyncResource';

/** 电视剧详情：整剧信息来自 TMDB，本地观看记录由各 SeasonBlock 独立读取。 */
const TvDetailPage: React.FC = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [posterOpenId, setPosterOpenId] = useState<number | null>(null);
    // 详情请求使用共享缓存；页面切换后由 Hook 忽略旧结果，不中断其他组件复用的请求。
    const load = useCallback(() => getTVShow(Number(id)), [id]);
    const {data: show, loading, error, retry} = useAsyncResource(`tv:${id}`, load);

    // 将已取得的整剧海报补回已有本地记录，不因浏览详情创建各季的观看记录。
    useEffect(() => {
        // 仅补齐已有记录的海报，不改变观看状态或最近互动时间。
        if (show) useProgressStore.getState().fillMissingPosters('tv_season', show.id, show.poster_path);
    }, [show]);

    const theme = useTheme();
    const primary = theme.palette.primary.main;
    const firstAirDate = show?.first_air_date?.trim();
    const tagline = show?.tagline?.trim();

    const backdropUrl = show?.backdrop_path ? getBackdropUrl(show.backdrop_path) : '';

    // 只展示季号大于 0 的常规季；特别篇（第 0 季）不在此页列出。
    const regularSeasons = show?.seasons.filter((s) => s.season_number > 0) ?? [];

    return (
        <React.Fragment>
            <Box sx={{minHeight: '100vh', backgroundColor: theme.palette.background.default}}>
                {/* 整剧背景图；缺失时使用主题背景，不影响下方详情展示。 */}
                <Box
                    sx={{
                        position: 'relative',
                        height: {xs: 220, sm: 300, md: 380},
                        overflow: 'hidden',
                        mb: -6,
                    }}
                >
                    {backdropUrl && (
                        <Box
                            component="img"
                            src={backdropUrl}
                            alt=""
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'brightness(0.4)',
                            }}
                        />
                    )}
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '80%',
                            background: `linear-gradient(to bottom, transparent, ${theme.palette.background.default})`,
                        }}
                    />
                    {/* 返回浏览器历史中的上一页。 */}
                    <IconButton
                        onClick={() => navigate(-1)}
                        sx={{
                            position: 'absolute',
                            top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                            left: 16,
                            backgroundColor: alpha('#000', 0.5),
                            color: '#fff',
                            '&:hover': {backgroundColor: alpha('#000', 0.7)},
                        }}
                    >
                        <ArrowBackIcon/>
                    </IconButton>
                </Box>

                <Container maxWidth="lg" sx={{pt: 6, pb: 8, position: 'relative'}}>
                    {error && <Alert severity="error" sx={{mb: 3}} action={<Button color="inherit" size="small"
                                                                                   onClick={retry}>重试</Button>}>{error}</Alert>}

                    {loading ? (
                        <Box sx={{display: 'flex', gap: 3}}>
                            <Skeleton variant="rounded" width={140} height={210}
                                      sx={{borderRadius: 1.5, flexShrink: 0}}/>
                            <Box sx={{flex: 1}}>
                                <Skeleton variant="text" width="60%" height={40}/>
                                <Skeleton variant="text" width="30%" height={24} sx={{mb: 1}}/>
                                <Skeleton variant="rounded" height={80}/>
                            </Box>
                        </Box>
                    ) : show ? (
                        <>
                            {/* 整剧概要，与下方每季的本地观看进度分开呈现。 */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: {xs: 'column', sm: 'row'},
                                gap: {xs: 2, sm: 3},
                                alignItems: {xs: 'center', sm: 'flex-start'}
                            }}>
                                {/* 整部剧的海报，季海报由季摘要单独提供。 */}
                                <ButtonBase
                                    disabled={!show.poster_path}
                                    aria-label={`查看${show.name}的海报相册`}
                                    onClick={() => setPosterOpenId(show.id)}
                                    sx={{
                                        width: {xs: 160, sm: 140},
                                        maxWidth: {xs: '55vw', sm: 'none'},
                                        aspectRatio: '2/3',
                                        objectFit: 'cover',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: `0 8px 32px ${alpha(primary, 0.4)}`,
                                        flexShrink: 0,
                                        mt: -4,
                                        position: 'relative',
                                        zIndex: 2,
                                    }}
                                >
                                    <Box component="img" src={getPosterUrl(show.poster_path, 'w342')} alt={show.name}
                                         sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                                </ButtonBase>
                                {/* 剧名、首播日期、评分、类型和简介均取自整剧详情接口。 */}
                                <Box sx={{flex: 1, minWidth: 0, width: {xs: '100%', sm: 'auto'}, pt: {xs: 0, sm: 1}}}>
                                    <Typography variant="h4" fontWeight={800} gutterBottom sx={{lineHeight: 1.2}}>
                                        {show.name}
                                    </Typography>
                                    {show.original_name !== show.name && (
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {show.original_name}
                                        </Typography>
                                    )}
                                    {tagline && (
                                        <Box component="blockquote" sx={{
                                            m: 0, mb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.75,
                                        }}>
                                            <FormatQuoteIcon aria-hidden="true" sx={{
                                                fontSize: 22, color: 'primary.main', flexShrink: 0, mt: 0.125,
                                                transform: 'rotate(180deg)',
                                            }}/>
                                            <Typography variant="body1" color="text.secondary" sx={{
                                                minWidth: 0, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 500,
                                                whiteSpace: 'pre-line', overflowWrap: 'anywhere',
                                            }}>
                                                {tagline}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5}}>
                                        {Number.isFinite(show.vote_average) && show.vote_average > 0 && (
                                            <Chip
                                                icon={<StarIcon
                                                    sx={{fontSize: '14px !important', color: '#FFD54F !important'}}/>}
                                                label={show.vote_average.toFixed(1)}
                                                size="small"
                                                sx={{
                                                    backgroundColor: alpha('#FFD54F', 0.15),
                                                    color: '#FFD54F',
                                                    fontWeight: 700
                                                }}
                                            />
                                        )}
                                        {firstAirDate && (
                                            <Chip
                                                label={firstAirDate}
                                                size="small"
                                                sx={{backgroundColor: alpha(primary, 0.15), color: primary}}
                                            />
                                        )}
                                        <Chip
                                            label={`${show.number_of_seasons} 季 · ${show.number_of_episodes} 集`}
                                            size="small"
                                            sx={{backgroundColor: alpha(primary, 0.15), color: primary}}
                                        />
                                        {show.genres.slice(0, 3).map((g) => (
                                            <Chip
                                                key={g.id}
                                                label={g.name}
                                                size="small"
                                                variant="outlined"
                                                sx={{borderColor: alpha(primary, 0.4), color: 'text.secondary'}}
                                            />
                                        ))}
                                    </Box>
                                    <ProductionInfo key={`production:${show.id}`}
                                                    spoken_languages={show.spoken_languages}
                                                    production_countries={show.production_countries}
                                                    production_companies={show.production_companies}
                                                    networks={show.networks}/>
                                    <ExpandableOverview key={show.id} text={show.overview || '暂无简介'}
                                                        collapsedLines={10}/>
                                </Box>
                            </Box>

                            <MediaCredits key={show.id} mediaId={show.id} mediaType="tv"/>
                            <MediaImageGallery key={`images:${show.id}`} mediaId={show.id} mediaType="tv"
                                               name={show.name} posterPath={show.poster_path}
                                               backdropPath={show.backdrop_path}
                                               posterOpen={posterOpenId === show.id}
                                               onPosterClose={() => setPosterOpenId(null)}/>

                            {/* 每季独立管理展开和加载状态，默认展开第一项。 */}
                            <Typography variant="h6" fontWeight={700} sx={{mt: 3, mb: 2, color: primary}}>
                                全部季数
                            </Typography>
                            {regularSeasons.map((season, idx) => (
                                <SeasonBlock
                                    key={season.id}
                                    tvId={show.id}
                                    showName={show.name}
                                    showPosterPath={show.poster_path}
                                    showOverview={show.overview}
                                    isOnlySeason={regularSeasons.length === 1}
                                    seasonSummary={season}
                                    defaultExpanded={idx === 0}
                                />
                            ))}
                            <MediaRecommendations key={`recommendations:${show.id}`} mediaId={show.id} mediaType="tv"/>
                            <MediaRecommendations key={`similar:${show.id}`} mediaId={show.id} mediaType="tv"
                                                  kind="similar"/>
                        </>
                    ) : null}
                </Container>
            </Box>
        </React.Fragment>
    );
};

export default TvDetailPage;
