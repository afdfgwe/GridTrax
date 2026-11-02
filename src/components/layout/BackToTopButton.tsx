import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {Box, Fab, Fade, Tooltip, useMediaQuery, useScrollTrigger} from '@mui/material';

/** 全站回顶入口，仅在向下滚动后显示，并遵循系统的减少动态效果偏好。 */
export default function BackToTopButton() {
    // 下滑超过 300px 后才出现，避免页面轻微滚动时按钮闪现。
    const visible = useScrollTrigger({disableHysteresis: true, threshold: 300});
    const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

    return (
        <Fade in={visible} unmountOnExit timeout={reduceMotion ? 0 : undefined}>
            <Box sx={{
                position: 'fixed',
                // 同时避开手机安全区域和屏幕边缘，横竖屏都保留可点击空间。
                right: {xs: 'max(16px, env(safe-area-inset-right))', sm: 'max(24px, env(safe-area-inset-right))'},
                bottom: {xs: 'max(16px, env(safe-area-inset-bottom))', sm: 'max(24px, env(safe-area-inset-bottom))'},
                zIndex: (theme) => theme.zIndex.fab
            }}>
                <Tooltip title="回到顶部" disableTouchListener>
                    <Fab color="primary" size="small" aria-label="回到顶部"
                         onClick={() => window.scrollTo({top: 0, behavior: reduceMotion ? 'instant' : 'smooth'})}
                         sx={{boxShadow: 2, '&:hover': {boxShadow: 3}}}>
                        <KeyboardArrowUpIcon/>
                    </Fab>
                </Tooltip>
            </Box>
        </Fade>
    );
}
