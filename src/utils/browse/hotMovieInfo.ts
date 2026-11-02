/** 豆瓣 info 依次为地区、类型、导演及演员，保留每段内部的原始文字。 */
export function parseHotMovieInfo(info?: string) {
    // 演员可能占用多个片段，全部保留并合并；空片段最后统一过滤，避免只有标签没有内容。
    const [region, genres, director, ...cast] = (info ?? '').split('/').map(part => part.trim());
    return [
        {label: '地区', value: region},
        {label: '类型', value: genres},
        {label: '导演', value: director},
        {label: '演员', value: cast.filter(Boolean).join(' · ')},
    ].filter(part => part.value);
}
