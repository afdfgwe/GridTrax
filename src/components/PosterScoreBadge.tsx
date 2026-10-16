import StarIcon from '@mui/icons-material/Star';
import {Box, Typography} from '@mui/material';

const PosterScoreBadge = ({score}: { score?: number }) => {
    if (score === undefined || !Number.isFinite(score) || score <= 0) return null;

    return (
        <Box
            aria-label={`TMDB 评分 ${score.toFixed(1)}`}
            sx={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.5,
                py: 0.25,
                borderRadius: 0.75,
                backgroundColor: 'rgba(0, 0, 0, 0.78)',
                color: '#FFE082',
                pointerEvents: 'none',
            }}
        >
            <StarIcon sx={{fontSize: 12}}/>
            <Typography component="span" sx={{fontSize: '0.7rem', fontWeight: 700, lineHeight: 1}}>
                {score.toFixed(1)}
            </Typography>
        </Box>
    );
};

export default PosterScoreBadge;
