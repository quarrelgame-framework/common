import { Dependency } from "@flamework/core";
import { Players, ReplicatedStorage, RunService } from "@rbxts/services";
import { QuarrelFunctions } from "network";

import type { Entity, EntityAttributes } from "components/entity.component";
import type MapNamespace from "components/map.component";
import type Character from "util/character";

/* FIXME: introduce some kind of project root transformer */
export const QuarrelGameFolder = ReplicatedStorage.WaitForChild("QuarrelGame") as Folder;
export const QuarrelCommands = QuarrelGameFolder.WaitForChild("QuarrelGame/cmdr") as Folder;
export const QuarrelAssets = <T extends Record<string, Character.CharacterRig>>() => QuarrelGameFolder.WaitForChild("QuarrelGame/assets") as QuarrelAssets<T>;
export const QuarrelModels = <T extends Record<string, Character.CharacterRig>>() => QuarrelAssets<T>().model;
export const QuarrelMaps = QuarrelAssets().model.map;

interface CharacterModel
{}

export interface QuarrelAssets<CharacterModels extends CharacterModel> extends Folder
{
    model: Folder & {
        map: Folder;

        character: {
            [key in keyof CharacterModels]: Character.CharacterRig;
        };
    };
}

export interface ParticipantAttributes
{
    ParticipantId: string;
    SelectedCharacter?: string;
    MatchId?: string;
}

/**
 * Whether a character is
 * sprinting or walking.
 */
export enum SprintState
{
    Walking,
    Sprinting,
}

export enum SessionType
{
    Singleplayer,
    Multiplayer,
}

export interface MatchSettings
{
    /**
     * The maximum amount of combatants.
     */
    MaxCombatants?: number;

    /**
     * The maximum amount of combatants per team.
     */
    MaxCombatantsPerTeam?: number;

    /**
     * The maximum amount of teams.
     */
    MaxTeams?: number;

    /**
     * The maximum amount of time allotted for the match.
     */
    MaxTime?: number;

    /**
     * The amount of stocks allotted for each combatant.
     */
    Stocks?: number;

    /**
     * The static scalar that determines how much damage
     * is dealt to a combatant.
     */
    DamageScalar?: number;

    /**
     * The static scalar that determines how much knockback
     * is dealt to a combatant.
     */
    KnockbackScalar?: number;

    /**
     * The static scalar that determines how much health
     * a combatant has.
     */
    HealthScalar?: number;

    /**
     * The static scalar that determines how much stamina
     * a combatant has.
     */
    StaminaScalar?: number;

    /**
     * The static scalar that determines how much tension
     * a combatant has.
     */
    TensionScalar?: number;

    /**
     * The static scalar that determines how much burst
     * a combatant has.
     */
    BurstScalar?: number;

    /**
     * The static scalar that determines how much guard
     * a combatant has.
     */
    GuardScalar?: number;

    /**
     * The static scalar that determines how fast a combatant
     * regains their Tension.
     */
    TensionRegenScalar?: number;

    /**
     * The static scalar that determines how fast a combatant
     * regains their Health.
     */
    HealthRegenScalar?: number;

    /**
     * The static scalar that determines how fast a combatant
     * regains their Stamina.
     */
    StaminaRegenScalar?: number;

    /**
     * The static scalar that determines how fast a combatant
     * regains their Burst.
     */
    BurstRegenScalar?: number;

    /**
     * The static scalar that determines how fast a combatant
     * regains their Guard.
     */
    GuardRegenScalar?: number;

    /**
     * Turbo mode is a mode that allows combatants to
     * perform actions faster than normal. Normals can
     * be chained into each other, and specials can be
     * chained into each other for a limited amount of time
     * after a normal.
     *
     * Determines whether Turbo Mode is enabled.
     */
    TurboMode?: boolean;

    /**
     * The map that the match will take place in.
     */
    Map: string;

    /**
     * The type of arena that the match will take place in.
     * Requires {@link MatchSettings.Map Map} to be set.
     *
     * @see {@link ArenaTypeFlags}
     */
    ArenaType: number;
}

export interface MatchState<EntityAttr extends EntityAttributes>
{
    /**
     * The current tick of the match.
     */
    Tick: number;

    /**
     * The current time of the match.
     */
    Time: number;

    /**
     * The state of the entities in the match.
     */
    EntityStates: Array<EntityAttr>;
}

export enum MatchPhase
{
    /**
     * The match is waiting for players to join.
     * This is generally the phase where the host
     * is setting up the match.
     */
    Waiting,
    /**
     * The match is starting. This is the phase
     * where players are being placed in the arena
     * or the arena is being loaded.
     */
    Starting,
    /**
     * The match is in progress. This is the phase where
     * players are actively fighting.
     */
    InProgress,
    /**
     * The match is ending. This is the phase where
     * the match is being cleaned up and the results
     * are being calculated and shown to the participants.
     */
    Ending,
    /**
     * The match has ended. This is the phase where
     * the match has fully cleaned up and the results
     * of the match are processed and stored in the
     * database.
     */
    Ended,
}

export interface MatchData
{
    /** The match's settings. */
    Settings: MatchSettings;

    /** The match's current state. */
    Phase: MatchPhase;

    /** The IDs of the match's current participants. */
    Participants: Array<ParticipantAttributes>;

    /** The match's current state. */
    State: MatchState<EntityAttributes>;

    /** The match's current map. */
    Map: Folder;

    /** The match's current arena. */
    Arena: Folder & {
        /** The model of the arena. */
        model: Model;
        /** Arena parameters. */
        config: MapNamespace.ConfigurationToValue;
        /** Arena controller. */
        script?: Actor;
    };

    MatchId: string;
}

/**
 * An enum describing
 * the possible states an
 * Entity can be in.
 */
export enum EntityState
{
    /**
     * A state where the Entity is
     * in their most neutral state.
     */
    Idle = 0x0001,

    /**
     * A state where the Entity
     * is walking.
     */
    Walk = 0x0002,

    /**
     * A state where the Entity
     * is dashing.
     */
    Dash = 0x0004,


    /**
     * A state where the entity
     * is sprinting.
     */
    Sprint = 0x0008,

    /**
     * A state where the Entity
     * was hit.
     */
    Hitstun = 0x0010,

    /**
     * A state where the Entity
     * was slammed down onto the
     * floor.
     */
    Knockdown = 0x0020,

    /**
     * A state where the Entity is
     * blocking.
     *
     * Unused on MoveDirection-based
     * blocking.
     */
    Block = 0x0040,

    /**
     * A state where the Entity
     * is crouching.
     */
    Crouch = 0x0080,

    /**
     * A state where the Entity
     * is about to jump.
     */
    Jumping = 0x0100,

    /**
     * A state where the Entity is
     * midair.
     */
    Midair = 0x0200,

    /**
     * A state where the Entity
     * is landing.
     */
    Landing = 0x0400,

    /**
     * A state where the Entity is
     * starting up their attack.
     */
    Startup = 0x0800,
    /**
     * A state where the Entity has
     * active hit frames.
     */
    Attack = 0x1000,
    /**
     * A state where the Entity is
     * vulnerable after whiffing an
     * attack.
     */
    Recovery = 0x2000,
}

/**
 * The result of a skill making
 * contact with an Entity.
 */
export enum HitResult
{
    /**
     * If the attack was
     * canceled.
     */
    Canceled,
    /**
     * If the attack was
     * not able to be ran.
     */
    Unknown,
    /**
     * If the attack missed.
     */
    Whiffed,
    /**
     * If the attack was blocked.
     */
    Blocked,
    /**
     * If the hit landed.
     */
    Contact,
    /**
     * If the hit landed and put the entity in a counter state.
     */
    Counter,
}

/**
 * Results of an offensive interaction.
 */
export interface HitData<Attacked extends Entity, Attacker extends Entity>
{
    hitResult: HitResult | Promise<HitResult>;
    attacked?: Attacked;
    attacker: Attacker;
}

/**
 * The region where the Hitbox
 * will hit.
 */
export enum HitboxRegion
{
    /**
     * The attack can be blocked by
     * crouch-blocking entities only.
     */
    Low,
    /**
     * The attack can be blocked by
     * standing-blocking entities or
     * crouch-blocking entities.
     */
    High,
    /**
     * The attack can be blocked by
     * standing-blocking entities only.
     */
    Overhead,
}

/**
 * Methods of blocking.
 */
export enum BlockMode
{
    /**
     * Attacks are blocked relative to the MoveDirection
     * of the character.
     */
    MoveDirection,
    /**
     * Attacks are blocked relative to the direction
     * the character is facing.
     */
    Orientation,
}

export function isStateNegative(state: number, excludeStates: number | EntityState[] = [])
{
    const filterSignature = 
        typeIs(excludeStates, "number") 
        ? ((e: number) => (excludeStates & e) === 0)
        : ((e: number) => !excludeStates.includes(e))

    return [
        EntityState.Startup,
        EntityState.Recovery,
        EntityState.Attack,
        EntityState.Hitstun,
        EntityState.Knockdown,
        EntityState.Jumping,
        EntityState.Landing,
        EntityState.Dash,
    ].filter(filterSignature).some((v) => (state & v) > 0);
}

export function isStateCounterable(state: number)
{
    return [ EntityState.Startup ].some((v) => (state & v) > 0);
}

export function isStatePunishable(state: number)
{
    return [ EntityState.Attack, EntityState.Recovery ].some((v) => (state & v) > 0);
}

export function isStateAggressive(state: number)
{
    return [
        EntityState.Startup,
        EntityState.Attack,
        EntityState.Recovery,
    ].some((v) => (state & v) > 0);
}

export function isStateNeutral(state: number)
{
    return [
        EntityState.Idle,
        EntityState.Crouch,
        EntityState.Walk,
        EntityState.Jumping,
        EntityState.Midair,
        EntityState.Landing,
    ].some((v) => (state & v) > 0);
}

/**
 *  Convert a percentage string to a number.
 */
export const ConvertPercentageToNumber = (percentage: string) => tonumber(percentage.match("(%d+)%%$")[0]);

/**
 * Make a character jump.
 */
export const Jump = (Character: Model & { Humanoid: Humanoid; PrimaryPart: BasePart; }, JumpDistance = 26) =>
{
    const { X, Y, Z } = Character.Humanoid.MoveDirection;
    const thisImpulse = new Vector3(math.sign(0), 1, math.sign(0)).mul(Character.PrimaryPart.AssemblyMass * JumpDistance);
    Character.PrimaryPart.ApplyImpulse(thisImpulse);
    Character.Humanoid.SetAttribute("JumpDirection", Character.Humanoid.MoveDirection);

    if (Character.GetAttribute("State") === EntityState.Jumping)
    {
        const _conn = Character.Humanoid.GetPropertyChangedSignal("FloorMaterial").Connect(() =>
        {
            if (Character.Humanoid.FloorMaterial !== Enum.Material.Air)
            {
                _conn.Disconnect();
                Character.Humanoid.SetAttribute("JumpDirection", undefined);
            }
        });
    }

    return Promise.resolve(true);
};

/**
 * Make a character dash.
 */
export const PhysicsDash = (Character: Model & { Humanoid: Humanoid; PrimaryPart: BasePart; }, direction = Character.PrimaryPart.CFrame.LookVector.mul(-1), dashPower = 28, conserveMomentum = true) =>
{
    const thisImpulse = direction.Unit.mul(Character.PrimaryPart.AssemblyMass * dashPower);

    if (conserveMomentum)
        Character.PrimaryPart.ApplyImpulse(thisImpulse);
    else
        Character.PrimaryPart.AssemblyLinearVelocity = thisImpulse;

    return Promise.resolve(true);
};

export const ConstraintDash = (Character: Model & { Humanoid: Humanoid; PrimaryPart: BasePart; }, direction = Character.PrimaryPart.CFrame.LookVector.mul(-1), dashPower = 28, conserveMomentum = true) =>
{
    const thisImpulse = direction.Unit;
    const entityAttachment = Character.PrimaryPart.FindFirstChild("MainAttachment");
    assert(entityAttachment, "mainattachment could not be found");

    return Promise.resolve(true);
}

export const CFrameDash = (Character: Model & { Humanoid: Humanoid; PrimaryPart: BasePart; }, direction = Character.PrimaryPart.CFrame.LookVector.mul(-1), dashPower = 28, conserveMomentum = true) =>
{
    const thisImpulse = direction.Unit;
    const entityAttachment = Character.PrimaryPart.FindFirstChild("MainAttachment");
    assert(entityAttachment, "mainattachment could not be found");

    return Promise.resolve(true);
}

/**
 * Remove the Y component of a Vector or CFrame.
 * Good for determining whether a character is facing another
 * only on a specific set of axes.
 */
export function NullifyYComponent(item: CFrame): CFrame;
export function NullifyYComponent(item: Vector3): Vector3;
export function NullifyYComponent(
    item: Vector3 | CFrame,
): Vector3 | CFrame
{
    return (typeIs(item, "CFrame") ? new CFrame(item.Position.mul(new Vector3(1, 0, 1))).mul(item.Rotation) : item.mul(new Vector3(1, 0, 1)));
}


export { getEnumValues } from "util/lib/other/enum";
export type ForChild<A extends {}, T extends keyof A = keyof A> = (child: T) => A[T] extends Instance ? A[T] : never;
