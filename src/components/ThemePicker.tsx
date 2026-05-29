import CheckIcon from '@mui/icons-material/Check';
import PaletteIcon from '@mui/icons-material/Palette';
import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { PREDEFINED_THEMES } from '../theme/themes';

const ThemePicker: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const { themeId, setThemeId } = useThemeStore();

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <Box>
            <IconButton onClick={handleClick} sx={{ color: 'text.secondary', ml: 1 }}>
                <PaletteIcon />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: { minWidth: 200, borderRadius: 2, mt: 1 },
                }}
            >
                <Box sx={{ px: 2, py: 1.5, pb: 1 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={700}>
                        选择主题
                    </Typography>
                </Box>
                {PREDEFINED_THEMES.map((t) => (
                    <MenuItem
                        key={t.id}
                        onClick={() => {
                            setThemeId(t.id);
                            handleClose();
                        }}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 1,
                            px: 2,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                                sx={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${t.primary.main} 0 50%, ${t.secondary.main} 50% 100%)`,
                                    border: `2px solid ${t.background.paper}`,
                                    boxShadow: `0 0 0 2px ${t.primary.dark}`,
                                }}
                            />
                            <Typography variant="body2" fontWeight={t.id === themeId ? 700 : 500}>
                                {t.name}
                            </Typography>
                        </Box>
                        {t.id === themeId && <CheckIcon fontSize="small" sx={{ color: t.primary.main }} />}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

export default ThemePicker;
