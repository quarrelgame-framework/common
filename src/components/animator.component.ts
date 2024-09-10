import { BaseComponent, Component } from "@flamework/components";
import { OnStart } from "@flamework/core";

import { Animation } from "util/animation";
import { EntityState } from "util/lib";
import { StateAttributes } from "components/state.component";

import CharacterManager from "singletons/character";
import Signal from "@rbxts/signal";
import Object from "@rbxts/object-utils";

// FIXME:
// Fix bug that makes the character pause
// before going back into their neutral
// animation

export namespace Animator
{
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

        constructor(protected CharacterManager: CharacterManager)
        {
            super();
        };

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
            const selectedCharacter = this.CharacterManager.GetCharacter(
                this.instance.GetAttribute("CharacterId") as string,
            );

            assert(
                selectedCharacter,
                `no selected character found on ${this.instance}`,
            );

            if (this.paused)
                return;

            if (typeIs(newState, "number"))
            {
                const availableAnimationStates = Object.keys(selectedCharacter.Animations)
                const playableAnimations = availableAnimationStates.filter((e) => (this.attributes.State & e) > 0).sort((a,b) =>
                {
                    const [c,d] = [selectedCharacter.Animations[a]!, selectedCharacter.Animations[b]!];
    
                    return (c.priority ?? Enum.AnimationPriority.Idle).Value < (d.priority ?? Enum.AnimationPriority.Idle).Value;
                });

                for (const animationState of playableAnimations)
                {
                    const newLoadedAnimation = this.LoadAnimation(
                        selectedCharacter.Animations[
                            animationState as keyof typeof selectedCharacter.Animations
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
                                // animationWasInterrupted = true;
                                print("0.25 fadetime");
                                this.currentLoadedAnimation?.Stop({ FadeTime: 0.25 });
                            }
                            else
                            {
                                // print("0 fadetime");
                                this.currentLoadedAnimation?.Stop({ FadeTime: 0.15 });
                            }
                        }
                    }

                    if ((this.attributes.State & animationState) >= 1)

                    {
                        if (this.currentLoadedAnimation !== newLoadedAnimation || !this.currentLoadedAnimation?.IsPlaying())
                        {
                            this.currentLoadedAnimation = newLoadedAnimation;
                            this.currentLoadedAnimation.Play({
                                FadeTime: 0,
                            }).then(() => print("oh yeah we playing", ));
                        }
                    }
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
