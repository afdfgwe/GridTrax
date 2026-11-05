import {Box, Slider, Stack, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';

interface SliderFilterProps {
    label: string;
    unit: string;
    value: number | number[];
    max: number;
    step: number;
    labelEvery: number;
    ariaLabels: string[];
    onChange: (value: number | number[]) => void;
}

/** 单值与范围筛选共用滑块，统一圆点、交互外圈及刻度样式。 */
export default function SliderFilter({
                                         label,
                                         unit,
                                         value,
                                         max,
                                         step,
                                         labelEvery,
                                         ariaLabels,
                                         onChange
                                     }: SliderFilterProps) {
    return <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" fontWeight={700}>{label}</Typography>
            <Typography variant="body2" color="primary.main" aria-live="polite"
                        sx={{fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
                {Array.isArray(value) ? `${value[0]}–${value[1]}` : value} {unit}
            </Typography>
        </Stack>
        <Box sx={{px: 1.25, pt: 0.5}}>
            <Slider value={value} min={0} max={max} step={step} shiftStep={step} disableSwap
                    getAriaLabel={index => ariaLabels[index]}
                    getAriaValueText={number => `${number} ${unit}`}
                    valueLabelDisplay="auto"
                    marks={Array.from({length: max / step + 1}, (_, index) => {
                        const number = index * step;
                        return {value: number, label: number % labelEvery === 0 ? String(number) : undefined};
                    })}
                    onChange={(_, next) => onChange(next)}
                    sx={theme => ({
                        '& .MuiSlider-thumb': {
                            width: 16,
                            height: 16,
                            '&:hover, &.Mui-focusVisible': {
                                boxShadow: `0 0 0 5px ${alpha(theme.palette.primary.main, 0.16)}`,
                                '@media (hover: none)': {boxShadow: 'none'},
                            },
                            '&.Mui-active': {
                                boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
                            },
                        },
                        '& .MuiSlider-markLabel': {fontSize: 12},
                    })}/>
        </Box>
    </Box>;
}
