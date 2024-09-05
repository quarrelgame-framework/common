import { Controller, Service, OnStart, OnInit, Modding } from "@flamework/core";
import Character from "util/character";

export interface OnCharacterRegistered {
    onCharacterRegistered(
        characterId: string,
        character: Character.Character,
    ): void;
}

@Controller({})
@Service({})
export class CharacterManager implements OnStart, OnInit
{
    private _characters: Map<string, Character.Character> = new Map();
    private listeners: Set<OnCharacterRegistered> = new Set();
    public GetCharacters(): ReadonlyMap<string, Character.Character>
    {
        return new ReadonlyMap([...this._characters]);
    }

    public GetCharacter(characterId: string): Character.Character | undefined
    {
        return this._characters.get(characterId);
    }

    public IdFromCharacter(character: Character.Character): string | undefined
    {
        return [...this._characters].find(([, char]) => char === character)?.[0];
    }

    public CharacterExists(characterId: string): boolean
    {
        return this._characters.has(characterId);
    }

    onInit(): void
    {
        Modding.onListenerAdded<OnCharacterRegistered>((listener) => this.listeners.add(listener));
    }

    onStart(): void {
        print("Character Manager started.")
    }

    public RegisterCharacter(characterId: string, character: Character.Character)
    {
        assert(!this._characters.has(characterId), `character id ${characterId} already exists`);
        print(`Character ${character.Name} (${characterId}) added.`)

        this._characters.set(characterId, character);
        for (const listener of this.listeners)

            listener.onCharacterRegistered(characterId, character);

    }

}

export default CharacterManager;
