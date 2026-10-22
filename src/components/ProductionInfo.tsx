import {Box, Tooltip, Typography} from '@mui/material';
import {useCallback, useState} from 'react';
import {getCountries, getPosterUrl} from '../api/tmdb';
import {useAsyncResource} from '../hooks/useAsyncResource';
import type {TMDBCountry, TMDBNetwork, TMDBProductionCompany, TMDBProductionCountry} from '../types';
import {getProductionCountriesText} from '../utils/movieProduction';

interface ProductionInfoProps {
    production_countries?: readonly TMDBProductionCountry[] | null;
    production_companies?: readonly TMDBProductionCompany[] | null;
    networks?: readonly TMDBNetwork[] | null;
}

/** 电影、电视剧共用制片信息；地区、公司和播出平台 Logo 依次排列，窄屏自然换行。 */
export default function ProductionInfo({production_countries, production_companies, networks}: ProductionInfoProps) {
    const hasCountryCodes = production_countries?.some(country => country.iso_3166_1.trim()) ?? false;
    const loadCountries = useCallback(
        () => hasCountryCodes ? getCountries() : Promise.resolve<TMDBCountry[]>([]),
        [hasCountryCodes],
    );
    const {data: countries} = useAsyncResource('production-countries:zh-CN', loadCountries);
    const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(() => new Set());
    const countryText = getProductionCountriesText(production_countries, countries);
    // 公司与平台的 ID 可能相同，用来源前缀区分，避免加载失败状态相互影响。
    const logoSources = [
        ...(production_companies ?? []).map(company => ({...company, source: 'company'})),
        ...(networks ?? []).map(network => ({...network, source: 'network'})),
    ];
    const logos = logoSources.flatMap(company => {
        const path = company.logo_path?.trim();
        const key = `${company.source}:${company.id}:${path}`;
        return path && !failedLogos.has(key) ? [{...company, path, key}] : [];
    });

    if (!countryText && !logos.length) return null;

    return (
        <Box role="group" aria-label={networks?.length ? '制片地区、出品公司与播出平台' : '制片地区与出品公司'} sx={{
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
