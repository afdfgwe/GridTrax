import {Box, Tooltip, Typography} from '@mui/material';
import {useCallback, useState} from 'react';
import {getCountries, getPosterUrl} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import type {TMDBCountry, TMDBMovie} from '../types';
import {getProductionCountriesText} from '../utils/movieProduction';

/** 地区与公司 Logo 共用一行，窄屏自然换行，不展示额外标题或公司名称。 */
export default function MovieProductionInfo({production_countries, production_companies}: Pick<
    TMDBMovie, 'production_countries' | 'production_companies'
>) {
    const hasCountryCodes = production_countries?.some(country => country.iso_3166_1.trim()) ?? false;
    const loadCountries = useCallback(
        () => hasCountryCodes ? getCountries() : Promise.resolve<TMDBCountry[]>([]),
        [hasCountryCodes],
    );
    const {data: countries} = useAsyncResource('production-countries:zh-CN', loadCountries);
    const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(() => new Set());
    const countryText = getProductionCountriesText(production_countries, countries);
    const logos = (production_companies ?? []).flatMap(company => {
        const path = company.logo_path?.trim();
        const key = `${company.id}:${path}`;
        return path && !failedLogos.has(key) ? [{...company, path, key}] : [];
    });

    if (!countryText && !logos.length) return null;

    return (
        <Box role="group" aria-label="制片地区与出品公司" sx={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            columnGap: 1, rowGap: 0.75, mb: 1.5,
        }}>
            {countryText && (
                <Typography variant="body2" color="text.secondary" aria-label={`制片地区：${countryText}`}
                            sx={{
                                maxWidth: '100%', minHeight: 24, px: 1, py: 0.125,
                                border: '1px solid', borderColor: 'divider', borderRadius: 1,
                                fontSize: '0.8125rem', lineHeight: '20px', overflowWrap: 'anywhere',
                            }}>
                    {countryText}
                </Typography>
            )}
            {logos.map(company => (
                <Tooltip key={company.key} title={company.name} disableTouchListener>
                    <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 56, height: 24, flexShrink: 0, px: 0.5, py: 0.5,
                        borderRadius: 1, backgroundColor: '#F5F6F7',
                    }}>
                        {/* 浅色底保持透明 Logo 可辨认；固定尺寸避免图片加载时挤动文字。 */}
                        <Box component="img" src={getPosterUrl(company.path, 'w92')} alt={company.name}
                             loading="lazy" decoding="async"
                             onError={() => setFailedLogos(previous => new Set([...previous, company.key]))}
                             sx={{display: 'block', width: '100%', height: '100%', objectFit: 'contain'}}/>
                    </Box>
                </Tooltip>
            ))}
        </Box>
    );
}
