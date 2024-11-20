import { BaseComponent, Component } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { EntityState } from "util/lib";

import Signal from "@rbxts/signal";
import { SchedulerService } from "singletons/scheduler";

export interface StateAttributes
{
    /**
     * The current State.
     */
    State: number;
}

@Component({})
export class StatefulComponent<A extends StateAttributes, I extends Instance> extends BaseComponent<A, I> implements OnStart
{
    private defaultState?: EntityState;

    private stateGuards: Map<EntityState, () => void> = new Map();

    private stateEffects: Map<EntityState, (oldState: EntityState) => void> = new Map();

    public readonly StateChanged = new Signal<(oldState: number, newState: number, wasForced?: boolean) => void>();

    constructor(protected readonly schedulerService: SchedulerService)
    {
        super()
    }

    onStart()
    {
        print(`State Component for Instance ${Instance}.`);
    }

    public GetStateEffect(state: EntityState): ((oldState: EntityState) => void) | undefined
    {
        return this.stateEffects.get(state);
    }

    public SetStateEffect(state: EntityState, effect: (oldState: EntityState) => void)
    {
        if (this.stateEffects.has(state))
            warn(`StateEffect for state ${state} already exists (${effect}). Overwriting.`);

        this.stateEffects.set(state, effect);
    }

    private doStateFunctions(state: number, force = false)
    {
        task.spawn(() => 
        {
            if (!this.IsState(state))

                this.attributes.State |= state;

            this.StateChanged.Fire(this.GetState(), state, force);
            this.stateEffects.get(state)?.(state);
        });
    }

    public SetState(...states: EntityState[])
    {
        for (const state of states)

            this.ForceState(state)

        return true;
    }

    public AddState(...states: EntityState[])
    {
        return this.SetState(...states);
    }

    public ClearState(...states: EntityState[])
    {
        for (const state of states)
            // TODO: maybe add support for leaving state effects? idk
            if (this.IsState(state))

                this.attributes.State &= ~state;

        return true;
    }


    public RemoveState(...states: EntityState[])
    {
        return this.ClearState(...states);
    }

    public ForceState(state: EntityState): void
    {
        this.doStateFunctions(state, true);
    }

    public GetState(): EntityState
    {
        return this.attributes.State as EntityState;
    }

    /* Returns true if any of the states match with the current.*/
    public IsState(...states: number[]): boolean
    {
        return states.some((e) => (e & this.attributes.State) >= 1);
    }

    /* Returns true if all of the states match with the current.*/
    public IsEveryState(...states: number[]): boolean
    {
        return states.every((e) => (e & this.attributes.State) >= 1);
    }

    public IsDefaultState(): boolean
    {
        assert(this.defaultState !== undefined, `default state is undefined for instance ${this.instance.Name}`);
        return (this.attributes.State === this.defaultState)
    }

    public SetDefaultState(state: EntityState)
    {
        this.defaultState = state;
    }

    public ResetState()
    {
        if (this.defaultState !== undefined)
            this.SetState(this.defaultState);
    }

    public async WhileInState(frames: number, state = this.attributes.State): Promise<void>
    {
        let stateListener: RBXScriptConnection | undefined;
        let elapsedFrames = 0;
        return Promise.race([
            new Promise<void>(async (res) =>
            {
                while (elapsedFrames < frames)
                {
                    await this.schedulerService.WaitForNextTick();
                    elapsedFrames++
                }

                stateListener?.Disconnect();
                res();
            }),
            new Promise<void>((_, rej) =>
            {
                stateListener = this.StateChanged.Connect(() =>
                {
                    if (!this.IsState(state))
                    {
                        stateListener?.Disconnect();
                        rej()
                    }
                });
            })
        ])
    }

    public GetCurrentStates(k: EntityState[] = [
        // FIX: this ugly fucking thing
        EntityState.Idle,
        EntityState.Midair,
        EntityState.Jumping,
        EntityState.Dash,
        EntityState.Walk,
        EntityState.Crouch,
        EntityState.Block,
        EntityState.Attack,
        EntityState.Sprint,
        EntityState.Hitstun,
        EntityState.Knockdown,
        EntityState.Startup,
        EntityState.Landing,
        EntityState.Recovery,
    ])
    {
        return k.filter((e) => this.IsState(e));
    }
}
