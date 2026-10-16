import {Typography} from '@mui/material';

/** 海报右下角的 TMDB 评分，不使用本地备份中保留的历史个人评分。 */
const PosterScoreBadge = ({score}: { score?: number }) => {
    // 未返回、非有限数或没有有效评分时不占据海报空间。
    if (score === undefined || !Number.isFinite(score) || score <= 0) return null;

    return (
        <Typography
            component="span"
            aria-label={`TMDB 评分 ${score.toFixed(1)}`}
            sx={{
                // 外层海报容器须相对定位；徽标不拦截点击，保持卡片导航可用。
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
