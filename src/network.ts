import type { MatchSettings, EntityState, MatchData } from "./util/lib";

import { Networking } from "@flamework/networking";
import { Input, Motion, MotionInput } from "./util/input";

/**
 * Functions that can only have callbacks defined on the server,
 * but can be executed on the client.
 *
 * 📝 Execution of these functions translate to the correlating
 * event or function being fired/invoked.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Server
{
    interface MovementFunctions
    {
        /**
         * Make the player crouch.
         */
        Crouch(crouchState: EntityState.Crouch | EntityState.Idle): boolean;
        /**
         * Make the player jump.
         */
        Jump(): boolean;
        /**
         * Make the character dash via Physics.
         */
        Dash(direction: Motion, dashPower?: number): Promise<boolean>;
        /**
         * Make the character dash via Constraints.
         */
        ConstraintDash(direction: Motion, dashPower?: number): Promise<boolean>;
        /**
         * Make the character dash via CFrame
         * interpolation.
         */
        InterpolateDash(direction: Motion, dashPower?: number): Promise<boolean>;
    }

    // FIXME: Deprecate
    // type InputFunctions = {
    //     /**
    //      * Execute an input.
    //      */
    //     [key in Input]: (this: InputFunctions) => boolean;
    // };

    /**
     * Functions related specifically to
     * the functionality of combat.
     *
     * e.g. `SubmitMotionInput`,
     */
    interface CombatFunctions //extends InputFunctions
    {
        /**
         * Submit a motion input to the server.
         * Especially useful in 2D fighters.
         */
        SubmitMotionInput(motionInput: MotionInput): boolean;
    }

    interface MatchFunctions
    {
        /**
         * Starts the match.
         * ---
         * ⚠️ This function is only callable by the match
         * host. If the player is not the match host, this
         * function will error.
         */
        StartMatch(): boolean;

        /**
         * Tell the server and other users that the player
         * is ready.
         */
        Ready(): boolean;

        /**
         * Tell the server and other users that the player
         * is not ready.
         */
        Unready(): boolean;

        /**
         * Creates a new match.
         *
         * @param matchSettings The settings to use for the match.
         * ---
         * ⚠️ This function is only callable by a player
         * who is not currently in a match. If the player
         * is in a match, this function will error.
         * ---
         * @returns The ID of the match.
         */
        CreateMatch(matchSettings?: MatchSettings): string;

        /**
         * Forcefully ends the match.
         * ---
         * ⚠️ This function is only callable by the match
         * host. If the player is not the match host, this
         * function will error.
         */
        ForceEndMatch(): boolean;

        /**
         * Re-creates the match with the same settings.
         * ---
         * ⚠️ This function is only callable by the match
         * host. If the player is not the match host, this
         * function will error.
         */
        Rematch(): boolean;

        /**
            * Modifies the match's settings live while the match is in progress.
            *
            * ---
            * ⚠️ This function is only callable by the match
            * host. If the player is not the match host, this
            * function will error.
            *
            * ⚠️ This can lead to unexpected behavior if some settings are changed
            * while the match is in progress. It is advised to only use this function
            * to change settings that are not related to the match's progression.

              * @param settings The settings to modify.
            */
        ModifyMatchSettings(settings: Partial<MatchSettings>): boolean;

        /**
         * Sets the match's settings.
         *
         * ---
         * ⚠️ This function is only callable by the match
         * host. If the player is not the match host, this
         * function will error.
         *
         * ⚠️ This function cannot be used to modify the match's settings
         * while the match is in progress. Use {@link ModifyMatchSettings} instead.
         */
        SetMatchSettings(settings: MatchSettings): boolean;

        /**
         * Gets the match's current state.
         *
         * @returns The match's current state.
         */
        GetCurrentMatch(): MatchData | undefined;
    }

    /**
     * Functions related specifically to
     * the functionality of the game.
     *
     * e.g. `BanPlayer`, `KickPlayer`, `GetTickRate`, `RequestDataStore`, etc.
     */
    interface GameFunctions extends CombatFunctions, MovementFunctions, MatchFunctions
    {
        /**
         * Get the game's tick rate.
         *
         * @returns The game's tick rate.
         */
        GetGameTickRate(): number;

        /**
         * Sets the player's character.
         *
         * @param characterId The character to spawn as when the match starts.
         */
        RequestSelectCharacter(characterId: string): boolean;
    }

    interface MatchEvents
    {
    }

    export interface Events extends MatchEvents
    {
        Test(): void;

        /*
         * Called by the client immediately when the user
         * is able to network.
         */
        Joined(): void;
    }

    /**
     * TODO: PLEASE make some kind of indication that
     * this is server functions and NOT client functions PLEASE
     */
    export interface Functions extends GameFunctions
    {
        /**
         * Respawns the player's character.
         *
         * @param characterId The character to respawn the player as.
         * If not provided, the player will respawn as their currently selected character.
         */
        RespawnCharacter(characterId?: string): Model;

        KnockbackTest(): boolean;
        TrailTest(): boolean;
        MatchTest(): boolean;

        /**
         * Determine whether an entity exists or otherwise.
         */
        EntityIsRegistered(entityId?: string): boolean;
    }
}

/**
 * Functions that can only have callbacks defined on the client,
 * but can be called the server.
 *
 * 📝 Execution of these functions translate to the correlating
 * event or function being fired/invoked.
 *
 * ⚠️  As such, functions defined here should be used sparingly
 * as they can be easily abused and lead to the server hanging. It
 * is advised to instead use events to communicate between the client and server
 * unless absolutely necessary.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Client
{
    interface MatchEvents
    {
        /**
         * Fired when the arena is changed,
         * usually through wall-breaks, finishers,
         * or cutscenes.
         */
        ArenaChanged(mapId: string, arenaId: string | number): void;
        /**
         * Fired when a participant has respawned back into the arena.
         */
        MatchParticipantRespawned(characterModel: Model): void;
        /**
         * Fired when a participant joins a match.
         */
        MatchJoined(matchId: string, matchData: ReturnType<Server.Functions["GetCurrentMatch"]>): void;
        /**
         * Fired when a match is started.
         */
        MatchStarted(matchId: string, matchData: ReturnType<Server.Functions["GetCurrentMatch"]>): void;
        /**
         * Fired when an entity is registered by the server, 
         * to be then registered by the client.
         */
        EntityRegistered(entityId: string, entityModel: Model, entityComponentId: string): void;
        /**
         * Fired when an entity is registered by the server, 
         * to be then registered by the client.
         */
        EntityUnregistered(entityId: string): void;
        /**
         * Fired when the client is joining in to sync
         * pre-existing entities.
         */
        SyncEntities(entities: (readonly [Model, string | undefined])[]): void;
    }

    export interface Events extends MatchEvents
    {
        /**
         * Let a client know that a Game frame has passed.
         */
        Tick(frameTime: number, tickRate: number): number;
        /**
         * Make the player jump.
         */
        Jump(jumpPower?: number): void;
        /**
         * Make the player dash via Physics.
         */
        Dash(direction: Vector3, dashPower?: number): void
        /**
         * Make the player dash via Constraints.
         */
        ConstraintDash(direction: Vector3, dashPower?: number): void
        /**
         * Make the player dash via CFrame
         * interpolation.
         */
        InterpolateDash(direction: Vector3, dashPower?: number): void
        /**
         * Make the player dash via Physics.
         */
        SetCombatMode(combatMode: CombatMode): void;
    }

    export enum CombatMode
    {
        /**
         * 2D combat mode.
         */
        TwoDimensional = "2D",
        /**
         * 3D combat mode.
         */
        ThreeDimensional = "3D",
    }

    export interface Functions
    {
        /**
         * Request the client to load a Map.
         */
        RequestLoadMap(mapId: string): boolean;
    }
}

export interface QuarrelGameNetworking
{
    Client: {
        Events: Client.Events;
        Functions: Client.Functions;
    },
    Server: {
        Events: Server.Events;
        Functions: Server.Functions;
    }
}

export const QuarrelEvents = Networking.createEvent<
    Server.Events,
    Client.Events
>();
export const QuarrelFunctions = Networking.createFunction<
    Server.Functions,
    Client.Functions
>();

export const Events = Networking.createEvent<QuarrelGameNetworking["Server"]["Events"],QuarrelGameNetworking["Client"]["Events"]>();
export const Functions = Networking.createFunction<QuarrelGameNetworking["Server"]["Functions"],QuarrelGameNetworking["Client"]["Functions"]>();
