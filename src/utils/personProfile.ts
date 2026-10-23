import type {TMDBPerson} from '../types/index.ts';

const DEPARTMENTS: Record<string, string> = {
    Acting: '演员', Directing: '导演', Writing: '编剧', Production: '制片',
    Camera: '摄影', Editing: '剪辑', Sound: '声音', Art: '美术',
    'Costume & Make-Up': '服装与化妆', 'Visual Effects': '视觉特效',
    Crew: '剧组', Lighting: '灯光', Creator: '创作者',
};

/** 搜索卡片与详情页共用职业翻译，未配置的部门保留接口原文。 */
export function getPersonDepartment(value?: string | null): string {
    const department = value?.trim() ?? '';
    return DEPARTMENTS[department] ?? department;
}

/** 日期按原始日历校验，不经过本地时区转换，避免生日偏移一天。 */
function validDate(value?: string | null): string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : '';
}

/** 整理可展示资料，不伪造未知性别、日期或别名；外链只允许 HTTP(S)。 */
export function getPersonProfile(person: TMDBPerson, now = new Date()) {
    const name = person.name?.trim() || '未知人物';
    const aliases = [...new Set((person.also_known_as ?? []).map(alias => alias.trim()))]
        .filter(alias => alias && alias !== name);
    const facts: { label: string; value: string }[] = [];
    const gender = ({1: '女', 2: '男', 3: '非二元性别'} as Record<number, string>)[person.gender ?? 0];
    if (gender) facts.push({label: '性别', value: gender});
    const birthday = validDate(person.birthday);
    const deathday = validDate(person.deathday);
    if (birthday) facts.push({label: '出生日期', value: birthday});
    // 使用本地日历计算周岁；已故人物以逝世日期为准，异常日期不推算年龄。
    const today = validDate([String(now.getFullYear()).padStart(4, '0'),
        String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
    const endDate = deathday || today;
    if (birthday && today && endDate && birthday <= endDate && endDate <= today
        && (!person.deathday?.trim() || deathday)) {
        const age = Number(endDate.slice(0, 4)) - Number(birthday.slice(0, 4))
            - (endDate.slice(5) < birthday.slice(5) ? 1 : 0);
        facts.push({label: deathday ? '享年' : '年龄', value: `${age} 岁`});
    }
    if (deathday) facts.push({label: '逝世日期', value: deathday});
    const birthplace = person.place_of_birth?.trim();
    if (birthplace) facts.push({label: '出生地', value: birthplace});
    const links: { label: string; href: string }[] = [];
    if (person.homepage?.trim()) {
        try {
            const url = new URL(person.homepage.trim());
            if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
                links.push({label: '个人网站', href: url.href});
            }
        } catch {
            // 无效官网地址不提供跳转，其余人物信息照常展示。
        }
    }
    const imdbId = person.imdb_id?.trim();
    if (imdbId && /^nm\d+$/.test(imdbId)) links.push({label: 'IMDb', href: `https://www.imdb.com/name/${imdbId}/`});
    return {
        name, department: getPersonDepartment(person.known_for_department), aliases, facts, links,
        biography: person.biography?.trim() ?? ''
    };
}
