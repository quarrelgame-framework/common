import { BaseComponent, Component } from "@flamework/components";
import { Dependency, OnStart, OnTick } from "@flamework/core";

import { HttpService, Players, RunService } from "@rbxts/services";
import { Animation } from "util/animation";
import { EntityState } from "util/lib";
import { StateAttributes } from "./state.component";

import Make from "@rbxts/make";
import Signal from "@rbxts/signal";
// import type { CharacterSelectController } from "@quarrelgame-framework/client";
import {Character} from "util/character";
import Object from "@rbxts/object-utils";
// import type { QuarrelGame } from "@quarrelgame-framework/server";

// FIXME:
// Fix bug that makes the character pause
// before going back into their neutral
// animation

export namespace Animator
{
    const Characters = new Map<string, Character.Character>();
    export function RegisterCharacters(characters: ReadonlyMap<string, Character.Character>)
    {
        for (const [id, character] of characters)

            Characters.set(id, character);
    }

    
    interface AnimatorProps
    {
        ActiveAnimation?: string;
    }

    @Component({})
    export class Animator<
        I extends AnimatorProps = AnimatorProps,
    > extends BaseComponent<
        I,
        Model & { Humanoid: Humanoid & { Animator: Instances["Animator"]; }; }
    >
    {
        protected loadedAnimations: Animation.Animation[] = [];

        public LoadAnimation(
            animation: Animation.AnimationData,
        ): Animation.Animation
        {
            const alreadyLoadedAnimation = this.loadedAnimations.find((e) => e.AnimationId === animation.assetId);
            if (alreadyLoadedAnimation)

                return alreadyLoadedAnimation;

            const loadedAnimation = new Animation.Animation(this, animation);
            this.loadedAnimations.push(loadedAnimation);

            return loadedAnimation;
        }

        public GetPlayingAnimations(): Animation.Animation[]
        {
            return this.Animator.GetPlayingAnimationTracks().mapFiltered((n) =>
            {
                return this.loadedAnimations.find(
                    (x) => x.AnimationId === n.Animation?.AnimationId,
                );
            });
        }

        public GetAnimator()
        {
            return this.Animator;
        }

        private readonly Animator = this.instance.Humanoid
            .Animator as unknown as Instances["Animator"] & {
                Parent: Humanoid & {
                    Animator: Instances["Animator"] & { Parent: Humanoid; };
                    Parent: Model;
                };
            };
    }

    interface StateAnimatorProps extends AnimatorProps, StateAttributes
    {}

    @Component({})
    export class StateAnimator extends Animator<StateAnimatorProps> implements OnStart 
    {
        private currentLoadedAnimation?: Animation.Animation;

        onStart(): void
        {
            while (!this.instance.Parent)
                task.wait();

            this.GetAnimator()
                .GetPlayingAnimationTracks()
                .forEach((a) => a.Stop(0));

            this.onStateChanged(EntityState.Idle);
            this.onAttributeChanged("State", (newState, oldState) => this.onStateChanged(newState));
        }

        private async onStateChanged(newState: AttributeValue)
        {
            const selectedCharacter = Characters.get(
                this.instance.GetAttribute("CharacterId") as string,
            );

            print(newState as number & EntityState.Midair)


            assert(
                selectedCharacter,
                `no selected character found on ${this.instance}`,
            );

            if (this.paused)
                return;

            if (typeIs(newState, "number"))
            {
                const availableAnimationStates = Object.keys(selectedCharacter.Animations)
                const playingAnimations = availableAnimationStates.filter((e) => (this.attributes.State & e) > 0).sort((a,b) =>
                {
                    const [c,d] = [selectedCharacter.Animations[a]!, selectedCharacter.Animations[b]!];
    
                    return (c.priority ?? Enum.AnimationPriority.Idle).Value < (d.priority ?? Enum.AnimationPriority.Idle).Value;
                });

                for (const newState of playingAnimations)
                {
                    const newLoadedAnimation = this.LoadAnimation(
                        selectedCharacter.Animations[
                            newState as keyof typeof selectedCharacter.Animations
                        ]!,
                    );
                    const animationWasInterrupted = false;
                    if (this.currentLoadedAnimation?.IsPlaying())
                    {
                        if (
                            newLoadedAnimation.AnimationId !== this.currentLoadedAnimation?.AnimationId
                        )
                        {
                            if (
                                newLoadedAnimation.Priority.Value >= (this.currentLoadedAnimation?.Priority.Value ?? 0)
                            )
                            {
                                if (
                                    newLoadedAnimation.AnimationId !== this.currentLoadedAnimation?.AnimationId
                                )
                                {
                                    // animationWasInterrupted = true;
                                    print("0.25 fadetime");
                                    this.currentLoadedAnimation?.Stop({ fadeTime: 0.25 });
                                }
                            }
                            else
                            {
                                // print("0 fadetime");
                                this.currentLoadedAnimation?.Stop({ fadeTime: 0.15 });
                            }

                            // if (
                            //     newLoadedAnimation.Priority === Enum.AnimationPriority.Idle
                            //     && this.currentLoadedAnimation?.Priority === Enum.AnimationPriority.Movement
                            //     && !animationWasInterrupted
                            // )
                            // {
                            //     animationWasInterrupted = true;
                            //     this.currentLoadedAnimation.Stop({ fadeTime: 0.25 });
                            // }
                        }
                    }

                    const isBecomingNeutralish = [ EntityState.Idle, EntityState.Crouch ].some((v) => (v & newState) > 1);

                    this.currentLoadedAnimation = newLoadedAnimation;
                    this.currentLoadedAnimation.Play({
                        FadeTime: isBecomingNeutralish ? 0 : (animationWasInterrupted ? 0 : undefined),
                    }).then(() => print("oh yeah we playing"));
                }
            }
        }

        private pausedState?: AttributeValue;
        public Pause(paused = true)
        {
            if (!paused)
            {
                this.Unpaused.Fire();
                this.paused = false;
                if (this.currentLoadedAnimation?.IsPaused())
                    this.currentLoadedAnimation?.Resume();

                if (this.attributes.State !== this.pausedState)
                    task.spawn(() => this.onStateChanged(this.attributes.State));
            }
            else
            {
                this.paused = true;
                this.currentLoadedAnimation?.Pause();
            }
        }

        public Unpause()
        {
            return this.Pause(false);
        }

        private paused = false;

        private Unpaused: Signal<() => void> = new Signal();
    }
}
