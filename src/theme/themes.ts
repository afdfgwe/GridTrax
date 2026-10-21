/** 项目主题的最小配置，统一映射到 MUI；颜色均按用途命名而非按具体组件命名。 */
export interface BaseThemeConfig {
    /** 持久化用的稳定标识，不应随显示名称变动，否则会影响已保存的主题偏好。 */
    id: string;
    name: string;
    mode?: 'light' | 'dark';
    /** 主色及其明暗变体；contrastText 是放在主色背景上的前景文字色。 */
    primary: { main: string; light: string; dark: string; contrastText: string };
    secondary: { main: string; light: string; dark: string; contrastText: string };
    /** default 用于整页背景，paper 用于卡片、菜单和弹窗等表面。 */
    background: { default: string; paper: string };
    text: { primary: string; secondary: string };
}

// 预设名称是界面展示数据，保留原有命名；数组首项同时作为默认与失效标识的兜底。
// 新增预设时需同时提供前景、背景和强调色；仅改主色无法形成完整的明暗主题。
export const PREDEFINED_THEMES: BaseThemeConfig[] = [
    {
        id: 'ocean',
        name: 'Ocean Blue',
        mode: 'dark',
        primary: {main: '#02a3fb', light: '#5ecbff', dark: '#0070bb', contrastText: '#ffffff'},
        secondary: {main: '#8fd3fb', light: '#c3e8fd', dark: '#4aa0ca', contrastText: '#003350'},
        background: {default: '#0a1014', paper: '#111a22'},
        text: {primary: '#e1eff8', secondary: '#92abbd'},
    },
    {
        id: 'dracula',
        name: 'Dracula',
        mode: 'dark',
        primary: {main: '#bd93f9', light: '#d6bcfb', dark: '#895df0', contrastText: '#282a36'},
        secondary: {main: '#ff79c6', light: '#ff9ce1', dark: '#da59b9', contrastText: '#282a36'},
        background: {default: '#282a36', paper: '#313444'},
        text: {primary: '#f8f8f2', secondary: '#6272a4'},
    },
    {
        id: 'nord',
        name: 'Nord Frost',
        mode: 'dark',
        primary: {main: '#88c0d0', light: '#8fbcbb', dark: '#5e81ac', contrastText: '#2e3440'},
        secondary: {main: '#81a1c1', light: '#98b7d6', dark: '#4c566a', contrastText: '#2e3440'},
        background: {default: '#2e3440', paper: '#3b4252'},
        text: {primary: '#d8dee9', secondary: '#e5e9f0'},
    },
    {
        id: 'tokyonight',
        name: 'Tokyo Night',
        mode: 'dark',
        primary: {main: '#7aa2f7', light: '#89b4fa', dark: '#3d59a1', contrastText: '#1a1b26'},
        secondary: {main: '#bb9af7', light: '#c0caf5', dark: '#7dcfff', contrastText: '#1a1b26'},
        background: {default: '#1a1b26', paper: '#1f2335'},
        text: {primary: '#c0caf5', secondary: '#565f89'},
    },
    {
        id: 'gruvbox',
        name: 'Gruvbox',
        mode: 'dark',
        primary: {main: '#fe8019', light: '#fabd2f', dark: '#d65d0e', contrastText: '#282828'},
        secondary: {main: '#8ec07c', light: '#b8bb26', dark: '#689d6a', contrastText: '#282828'},
        background: {default: '#282828', paper: '#32302f'},
        text: {primary: '#ebdbb2', secondary: '#a89984'},
    },
    {
        // 明亮主题同时配置浅色背景和深色文字，不只是替换强调色。
        id: 'sunlit-mint',
        name: 'Sunlit Mint',
        mode: 'light',
        primary: {main: '#008B8B', light: '#3FC7BD', dark: '#006466', contrastText: '#ffffff'},
        secondary: {main: '#FF7A59', light: '#FFB199', dark: '#C84F32', contrastText: '#24110b'},
        background: {default: '#F7FBF8', paper: '#FFFFFF'},
        text: {primary: '#172826', secondary: '#5F716D'},
    },
];

/** 旧偏好中的主题标识已被移除或无效时，回退到默认主题以保持页面可用。 */
export const getThemeConfig = (id: string): BaseThemeConfig => {
    return PREDEFINED_THEMES.find((t) => t.id === id) || PREDEFINED_THEMES[0];
};
