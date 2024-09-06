import { Modding, Reflect } from "@flamework/core";
import SkillManager from "singletons/skill";
import { Skill } from "util/character";

/**
 * @metadata flamework:implements flamework:parameters identifier
 */
export const QGSkill = Modding.createDecorator<[{id?: string}]>("Class", (descriptor, [{id}]) => {
    const objectIdentifier: string | undefined = id ?? Reflect.getMetadata(descriptor.object, "identifier");
    assert(objectIdentifier, `unable to get metadatum 'identifier' from object ${descriptor.object}`);

    const arbitrarySkill = new (descriptor.object as new () => Skill.Skill)();
    assert(("FrameData" in arbitrarySkill), `${typeOf(arbitrarySkill)} is not a Skill object.`);
    
    rawset(arbitrarySkill, "Id", objectIdentifier);
    Modding.resolveSingleton<SkillManager>(SkillManager).RegisterSkill(objectIdentifier, arbitrarySkill);
});


export default QGSkill;
