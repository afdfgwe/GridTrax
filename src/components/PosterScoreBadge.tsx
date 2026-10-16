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
                px: 0.5,
                py: 0.25,
                borderRadius: 0.75,
                backgroundColor: 'rgba(0, 0, 0, 0.78)',
                color: '#FFE082',
                fontSize: '0.75rem',
                fontWeight: 700,
                lineHeight: 1,
                pointerEvents: 'none',
            }}
        >
            {score.toFixed(1)}
        </Typography>
    );
};

export default PosterScoreBadge;
