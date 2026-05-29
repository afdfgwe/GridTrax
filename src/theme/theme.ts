import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import { type BaseThemeConfig } from './themes';

// Base Material You theme configuration
export const createAppTheme = (config: BaseThemeConfig, mode?: PaletteMode): Theme => {
    const paletteMode = mode ?? config.mode ?? 'dark';

    return createTheme({
        palette: {
            mode: paletteMode,
            primary: config.primary,
            secondary: config.secondary,
            background: config.background,
            surface: { main: config.background.default }, // Fallback standard surface
            text: config.text,
        },
        typography: {
            fontFamily: '"Inter", "Noto Sans SC", "Roboto", sans-serif',
            h4: { fontWeight: 700 },
            h5: { fontWeight: 600 },
            h6: { fontWeight: 600 },
        },
        shape: {
            borderRadius: 6,
        },
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

// Declare augmentation for MUI theme to include 'surface'
declare module '@mui/material/styles' {
    interface Palette {
        surface: Palette['primary'];
    }
    interface PaletteOptions {
        surface?: PaletteOptions['primary'];
    }
}

// We don't export a single defaultTheme anymore since it's dependent on the store,
// but we can export a dummy default if needed for tests.
import { PREDEFINED_THEMES } from './themes';
export const defaultTheme = createAppTheme(PREDEFINED_THEMES[0], 'dark');
