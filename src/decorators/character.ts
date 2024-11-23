import { Modding, Reflect } from "@flamework/core";
import { CharacterManager } from "singletons/character";

import type { MotionInput } from "util/input";
import Character, { Skill, type SkillLike } from "util/character";
import type { Constructor } from "@flamework/core/out/utility";
import SkillManager from "singletons/skill";
import { ICharacter } from "@quarrelgame-framework/types";

export type CharacterSetupFn = (characterModel: ICharacter) => unknown;
const undefinedSetupFunction = (() => undefined);

/**
 * Request the required metadata for lifecycle events and dependency resolution.
 * @metadata flamework:implements flamework:parameters identifier
 */
export const QGCharacter = Modding.createDecorator<[{id?: string, skills: [skill: MotionInput, attack: Constructor<Skill.Skill> | SkillLike][], setup?: CharacterSetupFn}]>("Class", (descriptor, [{id, skills, setup}]) => 
{
    const skillManager = Modding.resolveSingleton<SkillManager>(SkillManager);
    const mapFromMapLike = new ReadonlyMap([...skills].map(([skill, attack]) => 
    {
        if (typeIs(rawget(attack, "new"), "function"))
        {
            const SkillIdentifier = Reflect.getMetadata(attack, "identifier") as string;
            assert(SkillIdentifier, `could not get skill identifier from ${attack}`)

            return [skill, skillManager.GetSkill(SkillIdentifier)!];
        }

        return [skill, attack];
    }));

    const objectIdentifier: string | undefined = id ?? Reflect.getMetadata(descriptor.object, "identifier");
    assert(objectIdentifier, `unable to get metadatum 'identifier' from object ${descriptor.object}`);

    Reflect.defineMetadataBatch(descriptor.object, {
        ["qgf.id"]: objectIdentifier,
        ["qgf.character.setup"]: setup ?? undefinedSetupFunction,
    });

    const arbitraryCharacter = new (descriptor.object as new () => Character.Character)();
    rawset(arbitraryCharacter, "Skills", mapFromMapLike);

    Modding.resolveSingleton<CharacterManager>(CharacterManager).RegisterCharacter(objectIdentifier, arbitraryCharacter);
});


export default QGCharacter;
