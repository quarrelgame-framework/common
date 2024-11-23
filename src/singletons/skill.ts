import { Controller, Service, OnStart, OnInit, Modding } from "@flamework/core";
import type { Skill } from "util/character";

export interface OnSkillRegistered {
    onSkillRegistered(
        skillId: string,
        skill: Skill.Skill,
    ): void;
}

@Controller({})
@Service({})
export class SkillManager implements OnStart, OnInit
{
    private _skills: Map<string, Skill.Skill> = new Map();
    private listeners: Set<OnSkillRegistered> = new Set();
    public GetSkills(): ReadonlyMap<string, Skill.Skill>
    {
        return new ReadonlyMap([...this._skills]);
    }

    public GetSkill(skillId: string): Skill.Skill | undefined
    {
        return this._skills.get(skillId);
    }

    public IdFromSkill(skill: Skill.Skill): string | undefined
    {
        return [...this._skills].find(([, _skill]) => _skill === skill)?.[0];
    }

    public SkillExists(skillId: string): boolean
    {
        return this._skills.has(skillId);
    }

    onInit(): void
    {
        Modding.onListenerAdded<OnSkillRegistered>((listener) => this.listeners.add(listener));
    }

    onStart(): void {
        print("Skill Manager started.")
    }

    public RegisterSkill(skillId: string, skill: Skill.Skill)
    {
        assert(!this._skills.has(skillId), `skill id ${skillId} already exists`);
        print(`Skill ${skill.Name} (${skillId}) added as ${skillId}.`)

        this._skills.set(skillId, skill); 
        for (const listener of this.listeners)

            listener.onSkillRegistered(skillId, skill);
    }

}

export default SkillManager;
