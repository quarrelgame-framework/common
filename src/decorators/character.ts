import { Modding, Reflect } from "@flamework/core";
import { CharacterManager } from "singletons/character";
import Character from "util/character";

/**
 * Request the required metadata for lifecycle events and dependency resolution.
 * @metadata flamework:implements flamework:parameters identifier
 */
export const QGCharacter = Modding.createDecorator<[{id?: string}]>("Class", (descriptor, [{id}]) => 
{
    const objectIdentifier: string | undefined = Reflect.getMetadata(descriptor.object, "identifier");
    Modding.resolveSingleton<CharacterManager>(CharacterManager).RegisterCharacter(id ?? objectIdentifier ?? `unknown-${tostring(descriptor.object)}`, new (descriptor.object as new () => Character.Character)());
});

