import {Typography} from '@mui/material';

const PosterScoreBadge = ({score}: { score?: number }) => {
    if (score === undefined || !Number.isFinite(score) || score <= 0) return null;

    return (
        <Typography
            component="span"
            aria-label={`TMDB 评分 ${score.toFixed(1)}`}
            sx={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                color: '#FFE082',
                fontSize: '0.75rem',
                fontWeight: 700,
                lineHeight: 1,
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
                pointerEvents: 'none',
            }}
        >
            {score.toFixed(1)}
        </Typography>
    );
};

export default PosterScoreBadge;
