import {useState} from 'react';
import {Box, Card, CardActionArea, CardContent, Chip, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {Link} from 'react-router-dom';
import {getPosterUrl} from '../api/tmdb';
import type {TMDBCollectionSearchResult} from '../types';

/** 合集使用独立详情路由，避免与相同编号的电影混淆。 */
export default function CollectionSearchCard({item}: { item: TMDBCollectionSearchResult }) {
    const title = item.name?.trim() || item.original_name?.trim() || '未知合集';
    const originalName = item.original_name?.trim();
    const [failedPath, setFailedPath] = useState<string>();
    const poster = item.poster_path && item.poster_path !== failedPath ? item.poster_path : undefined;

    return (
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper'}}>
            <CardActionArea component={Link} to={`/collection/${item.id}`} aria-label={`查看${title}合集详情`}
                            sx={{
                                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                                justifyContent: 'flex-start', color: 'inherit', textDecoration: 'none'
                            }}>
                <Box sx={{position: 'relative', aspectRatio: '2/3', overflow: 'hidden', bgcolor: 'action.hover'}}>
                    <Box component="img" loading="lazy" src={getPosterUrl(poster, 'w342')} alt={title}
                         onError={() => {
                             if (poster) setFailedPath(poster);
                         }}
                         sx={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}/>
                    <Chip label="合集" size="small" sx={{
                        position: 'absolute', top: 8, left: 8,
                        bgcolor: alpha('#90CAF9', 0.9), color: '#000', fontWeight: 700, fontSize: '0.65rem',
                    }}/>
                </Box>
                <CardContent sx={{flex: 1, minWidth: 0, pb: '12px !important'}}>
                    <Typography variant="body2" fontWeight={700} noWrap title={title}>{title}</Typography>
                    {originalName && <Typography variant="caption" color="text.secondary" component="p"
                                                 noWrap title={originalName} sx={{mt: 0.75, mb: 0, lineHeight: 1.6}}>
                        {originalName}
                    </Typography>}
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
