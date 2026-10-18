import {createTheme, type PaletteMode, type Theme} from '@mui/material/styles';
import {type BaseThemeConfig} from './themes';

/** 将项目配色转换为完整 MUI 主题，并集中定义通用字体、圆角和组件样式。 */
export const createAppTheme = (config: BaseThemeConfig, mode?: PaletteMode): Theme => {
    // 显式参数优先，其次使用预设模式；旧配置未声明模式时按深色处理。
    const paletteMode = mode ?? config.mode ?? 'dark';

    return createTheme({
        palette: {
            mode: paletteMode,
            primary: config.primary,
            secondary: config.secondary,
            background: config.background,
            surface: {main: config.background.default}, // 扩展表面色默认与整页背景保持一致。
            text: config.text,
        },
        typography: {
            fontFamily: '"Inter", "Noto Sans SC", "Roboto", sans-serif',
            h4: {fontWeight: 700},
            h5: {fontWeight: 600},
            h6: {fontWeight: 600},
        },
        shape: {
            borderRadius: 6,
        },
        // 共享覆盖集中维护；页面自身仅补充局部布局与交互所需的样式。
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        textTransform: 'none',
                        fontWeight: 600,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        backgroundImage: 'none',
                        boxShadow: 'none',
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 4,
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 8,
                        },
                    },
                },
            },
            MuiLinearProgress: {
                styleOverrides: {
                    root: {
                        borderRadius: 4,
                    },
                },
            },
        },
    });
};

// 扩展 MUI 类型声明，使创建主题和读取 palette.surface 时均有类型提示。
declare module '@mui/material/styles' {
    interface Palette {
        surface: Palette['primary'];
    }

    interface PaletteOptions {
        surface?: PaletteOptions['primary'];
    }
}
