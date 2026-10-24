import type {TMDBCastMember, TMDBCredits, TMDBCrewMember, TMDBTVAggregateCredits} from '../types/index.ts';

/** 整剧角色合并展示，幕后按实际职务展开，复用电影的排序、去重和分组规则。 */
export function normalizeTVAggregateCredits(data: TMDBTVAggregateCredits): TMDBCredits {
    return {
        id: data.id,
        cast: data.cast.map(({roles, ...person}) => ({
            ...person,
            character: [...new Set((roles ?? []).map(role => role.character?.trim()).filter(Boolean))].join(' / '),
        })),
        crew: data.crew.flatMap(({jobs, ...person}) =>
            (jobs ?? []).map(({job, credit_id}) => ({...person, job, credit_id}))),
    };
}

// 常见主创职务，分组时始终排在最前，其余职务按接口顺序追加。
export const MAIN_CREW_LABELS = ['导演', '编剧', '制片', '执行制片'] as const;

const JOB_LABELS: Record<string, string> = {
    Director: '导演', Writer: '编剧', Screenplay: '编剧', Producer: '制片',
    'Executive Producer': '执行制片', 'Co-Producer': '联合制片',
    'Associate Producer': '协同制片', 'Action Director': '动作导演',
    'Director of Photography': '摄影指导', 'Original Music Composer': '原创配乐',
    Editor: '剪辑', 'Art Direction': '美术指导', 'Production Design': '制作设计',
    'Costume Design': '服装设计', Casting: '选角', Story: '故事',
    'Assistant Director': '副导演', Choreographer: '编舞', 'Fight Choreographer': '动作编排',
    'Martial Arts Choreographer': '武术指导', Presenter: '出品人', 'Production Manager': '制片主任',
    'Stunt Coordinator': '特技指导', Stunts: '特技演员', Thanks: '鸣谢',
    'Theme Song Performance': '主题曲演唱', Creator: '创作者',
};

/** 影片演职员与人物影视履历共用职务译名，未知职务保留接口原文。 */
export function getCreditJobLabel(value?: string | null): string {
    const job = value?.trim();
    return job ? JOB_LABELS[job] || job : '其他幕后';
}

/** 按演职员表顺序展示；同一演员的多个角色合并，不改变接口数组。 */
export function getOrderedCast(cast: readonly TMDBCastMember[] = []): TMDBCastMember[] {
    const people = new Map<number, TMDBCastMember>();
    const characters = new Map<number, Set<string>>();
    const ordered = [...cast].sort((a, b) =>
        (Number.isFinite(a.order) ? a.order! : Infinity) - (Number.isFinite(b.order) ? b.order! : Infinity));
    for (const member of ordered) {
        const name = member.name?.trim() || member.original_name?.trim();
        if (!name) continue;
        const previous = people.get(member.id);
        const roles = characters.get(member.id) ?? new Set<string>();
        const character = member.character?.trim();
        if (character) roles.add(character);
        characters.set(member.id, roles);
        people.set(member.id, {
            ...member, ...previous, name,
            profile_path: previous?.profile_path || member.profile_path,
            character: [...roles].join(' / '),
        });
    }
    return [...people.values()];
}

export interface CrewGroup {
    label: string;
    members: TMDBCrewMember[];
}

/** 使用本片 job 而非人物擅长领域分组，未识别的职务保留原文。 */
export function getCrewGroups(crew: readonly TMDBCrewMember[] = []): CrewGroup[] {
    const groups = new Map<string, Map<number, TMDBCrewMember>>();
    for (const member of crew) {
        const name = member.name?.trim() || member.original_name?.trim();
        if (!name) continue;
        const label = getCreditJobLabel(member.job);
        const members = groups.get(label) ?? new Map<number, TMDBCrewMember>();
        if (!members.has(member.id)) members.set(member.id, {...member, name});
        groups.set(label, members);
    }
    const labels = [...new Set([...MAIN_CREW_LABELS, ...groups.keys()])];
    return labels.flatMap(label => {
        const members = groups.get(label);
        return members ? [{label, members: [...members.values()]}] : [];
    });
}
