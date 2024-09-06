// import type * as Entity from "components/entity.component";
// import type { Combat } from "singletons/combat.service";
// import type { Scheduler } from "singletons/scheduler";
import type { Animator } from "components/animator.component";
import { Animation } from "util/animation";
import { EntityState, HitboxRegion, HitData, HitResult } from "util/lib";

import { Hitbox } from "util/hitbox";
import { Entity, EntityAttributes } from "components/entity.component";
import { Input, isInput, Motion, MotionInput } from "./input";

import { Dependency, Modding } from "@flamework/core";
import { CharacterRigR6 as CharacterRigR6_ } from "@rbxts/promise-character";
import { HttpService, ReplicatedStorage, RunService } from "@rbxts/services";
import { Identifier } from "./identifier";

import QuarrelGameMetadata from "singletons/metadata";
import { SchedulerService } from "singletons/scheduler";


type SkillName = string;
export type SkillLike = Skill.Skill | ((castingEntity?: Entity, targetEntities?: Set<Entity>) => Skill.Skill)

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Character
{
    type EaseOfUse = 1 | 2 | 3 | 4 | 5;

    export const MaximumEaseOfUse = 5;

    export type CharacterRig = CharacterRigR6_ & { PrimaryPart: BasePart; Humanoid: CharacterRigR6_["Humanoid"] & { Animator: Animator; }; };

    export enum CharacterRigType
    {
        Raw,
        HumanoidDescription,
    }

    export const GetCharacterModel = <CharacterModels>() =>
        table.freeze(setmetatable({}, {
            __index: (_, index) =>
            {
                assert(typeIs(index, "string"), "index is not a string.");

                const quarrelGame = ReplicatedStorage.WaitForChild("QuarrelGame") as Folder;
                const quarrelAssets = quarrelGame.WaitForChild("QuarrelGame/assets") as Folder;
                const quarrelModels = quarrelAssets.WaitForChild("model") as Folder;
                const characterModels = quarrelModels.WaitForChild("character") as Folder;

                assert(characterModels.FindFirstChild(index), `character model of name ${index} does not exist.`);

                return characterModels[index as never] as unknown as Character.CharacterRig;
            },
        })) as CharacterModels;

    export enum Archetype
    {
        WellRounded = "Well-Rounded",
        Technical = "Technical",
        Rushdown = "Rushdown",
        Beatdown = "Beatdown",
        Special = "Special",
    }

    export type Animations = {
        [K in EntityState]?: Animation.AnimationData;
    };

    interface CharacterProps
    {
        Name: string;

        Description: string;

        EaseOfUse: EaseOfUse;

        CharacterModel: Model & { PrimaryPart: BasePart; Humanoid: Humanoid & { Animator?: Animator; }; };

        RigType: CharacterRigType;

        Animations: Animations;

        CharacterArchetype: Archetype;

        CharacterHeader?: string;

        CharacterSubheader?: string;

        MaximumAirOptions: number;

        MaximumAirDashes: number;

        MaximumAirJumps: number;
        
        EightWayDash: boolean;


        Skills: Map<MotionInput, SkillLike>
    }

    export enum CharacterEvent
    {
        SKILL_CAST,
        METER,

        DAMAGED,
        HEALED,

        ATTACK,
        ANIMATION_START,
        ANIMATION_END,
    }

    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace CharacterEventSignatures
    {
        export type SkillCast = (skillId: string) => void;
        export type Meter = (meter: number) => void;
        export type Damaged = (healthOld: number, healthNew: number) => void;
        export type Healed = (healthOld: number, healthNew: number) => void;
        export type Attack = (attackId: string) => void;
        export type AnimationStart = (animation: Animation.Animation) => void;
        export type AnimationEnd = (animation: Animation.Animation) => void;
    }

    type CharacterEventSignature<T extends CharacterEvent> = T extends typeof CharacterEvent["SKILL_CAST"] ? CharacterEventSignatures.SkillCast
        : T extends typeof CharacterEvent["METER"] ? CharacterEventSignatures.SkillCast
        : T extends typeof CharacterEvent["DAMAGED"] ? CharacterEventSignatures.AnimationEnd
        : T extends typeof CharacterEvent["HEALED"] ? CharacterEventSignatures.Healed
        : T extends typeof CharacterEvent["ATTACK"] ? CharacterEventSignatures.Attack
        : T extends typeof CharacterEvent["ANIMATION_START"] ? CharacterEventSignatures.AnimationStart
        : T extends typeof CharacterEvent["ANIMATION_END"] ? CharacterEventSignatures.AnimationEnd
        : never;

    interface CharacterProps2D extends CharacterProps
    {
        character3D?: CharacterProps3D;
    }

    interface CharacterProps3D extends CharacterProps
    {
        character2D?: CharacterBuilder2D;
    }

    export class Character
    {
        public static isCharacter(T: defined): T is Character.Character
        {
            return getmetatable(T) === getmetatable(this);
        }

        readonly Name: string;

        readonly Description: string;

        readonly EaseOfUse: EaseOfUse;

        readonly Header?: string;

        readonly Subheader?: string;

        readonly Model: Model & { PrimaryPart: BasePart; Humanoid: Humanoid & { Animator?: Animator; }; };

        readonly Skills: CharacterProps["Skills"] = new Map();

        readonly Archetype: Archetype;

        readonly Animations: Animations;

        readonly RigType: CharacterRigType;


        constructor(destructorParams: CharacterProps)
        {
            const {
                Name,
                Description,
                EaseOfUse,
                CharacterModel,
                Animations,
                Skills,
                CharacterHeader,
                CharacterSubheader,
                RigType,
                CharacterArchetype,
            } = destructorParams ?? this;

            this.Name = Name;
            this.Description = Description;
            this.EaseOfUse = EaseOfUse;
            this.Model = CharacterModel;
            this.Skills = Skills;
            this.Animations = Animations;
            this.Archetype = CharacterArchetype;
            this.Header = CharacterHeader;
            this.Subheader = CharacterSubheader;
            this.RigType = RigType;
        }
    }

    abstract class CharacterBuilder
    {
        protected Name?: string;

        protected Description?: string;

        protected EaseOfUse?: EaseOfUse;

        protected CharacterModel?: CharacterProps["CharacterModel"];

        protected Animations: Animations = {};

        protected RigType: CharacterRigType = CharacterRigType.HumanoidDescription;

        protected Skills: CharacterProps["Skills"] = new Map();

        protected CharacterArchetype: Archetype = Archetype.WellRounded;

        protected CharacterHeader?: string;

        protected CharacterSubheader?: string;

        protected MaximumAirOptions?: number;

        protected MaximumAirDashes?: number;

        protected MaximumAirJumps?: number;

        protected EightWayDash?: boolean;


        public SetName(name: string)
        {
            this.Name = name;

            return this;
        }

        public SetHeader(header: string)
        {
            this.CharacterHeader = header;

            return this;
        }

        public SetSubheader(subheader: string)
        {
            this.CharacterSubheader = subheader;

            return this;
        }

        public SetDescription(description: string)
        {
            this.Description = description;

            return this;
        }

        public SetEasiness(easeOfUse: EaseOfUse)
        {
            this.EaseOfUse = easeOfUse;

            return this;
        }

        public SetModel(characterModel: CharacterProps["CharacterModel"], rigType = CharacterRigType.HumanoidDescription)
        {
            this.CharacterModel = characterModel;
            this.RigType = rigType;

            return this;
        }

        public SetSkill(input: Input | MotionInput, skill: SkillLike)
        {
            this.Skills.set(isInput(input) ? [ input ] : input, skill);

            return this;
        }

        public SetAnimation(animationId: keyof typeof this.Animations, animationData: Animation.AnimationData)
        {
            this.Animations[animationId] = animationData;

            return this;
        }
        
        public SetSetup(setupFunction: CharacterProps["Setup"])
        {
            this.Setup = setupFunction;
        }

        public Compile(): CharacterProps
        {
            // eslint-disable-next-line max-len
            const { Name, Description, EaseOfUse, CharacterModel, RigType, Skills, Animations, CharacterArchetype, CharacterHeader, CharacterSubheader, MaximumAirOptions, MaximumAirJumps, MaximumAirDashes, EightWayDash = false } =
                this;

            assert(CharacterModel, "Builder incomplete! Character model is unset.");
            assert(Name, "Builder incomplete! Name is unset.");
            assert(Description, "Builder incomplete! Description is unset.");
            assert(EaseOfUse, "Builder incomplete! Ease of use is unset.");
            return {
                Name,
                Description,
                EaseOfUse,
                CharacterModel,
                Skills,
                Animations,
                CharacterArchetype,
                CharacterHeader,
                CharacterSubheader,
                MaximumAirOptions: MaximumAirOptions ?? 2,
                MaximumAirJumps: MaximumAirJumps ?? 1,
                MaximumAirDashes: MaximumAirDashes ?? 1,
                EightWayDash,
                RigType,
            };
        }

        public Construct()
        {
            return new Character(this.Compile());
        }
    }

    export class CharacterBuilder2D extends CharacterBuilder
    {
        private character3D?: Character & { Character2D: Character; };

        public Set3DCharacter(character: Character & { Character2D: Character; })
        {
            this.character3D = character;
        }
    }

    export class CharacterBuilder3D extends CharacterBuilder
    {
        private character2D?: Character & { Character2D: Character; };

        public Set2DCharacter(character: Character & { Character2D: Character; })
        {
            this.character2D = character;
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Skill
{
    /* TODO:
     * turn quarrelgame into a shared
     * singleton (use @Controller and @Service for the same class maybe?)
     * and then use Dependency<T>() to get the singleton
     */
    interface FrameDataClassProps
    {
         Startup: number;

         Active: number;

         Recovery: number;

         HitStun: number;

         BlockStun: number;

         Contact: number;

         Animation: Animation.AnimationData;

         Hitbox: Hitbox.Hitbox;
     }

    class _FrameData
     {
         protected AttackSetup<I extends EntityAttributes>({ Humanoid }: Entity<I>)
         {
             Humanoid.Move(Vector3.zero, true);
         }
     }

    export class FrameData extends _FrameData
     {
         /**
          * How many frames it takes for
          * the attack to become active.
          */
         public readonly StartupFrames;

         /**
          * How many frames the hitbox
          * will be enabled for.
          */
         public readonly ActiveFrames;

         /**
          * How many frames the Entity
          * will be unable to act after
          * the active frames.
          *
          * Is subtracted by the {@link FrameData.Contact Contact Frames}.
          */
         public readonly RecoveryFrames;

         /**
          * How many frames a character
          * that gets hit by this move
          * while blocking will be put
          * in a block-stun state.
          */
         public readonly BlockStunFrames;

         /**
          * How many frames a character
          * that gets hit by this move
          * while idle will be put
          * in a hit-stun state.
          */
         public readonly HitStunFrames;

         /**
          * How many frames the Entity
          * will be given if the attack
          * while the attacked entity is not
          * blocking.
          *
          * 'Effectively' subtracts from the {@link FrameData.RecoveryFrames Recovery Frames}.
          */
         public readonly Contact;

         /**
          * The Animation of the Frame Data.
          */
         public readonly Animation;

         /**
          * The Hitbox of the Frame Data.
          */
         public readonly Hitbox;

         constructor({ Startup, Recovery, HitStun, BlockStun, Active, Animation, Hitbox, Contact }: FrameDataClassProps)
         {
             super();

             this.StartupFrames = Startup;
             this.RecoveryFrames = Recovery;
             this.BlockStunFrames = BlockStun;
             this.HitStunFrames = BlockStun;
             this.ActiveFrames = Active;
             this.Animation = Animation as Readonly<NonNullable<Animation.AnimationData>>;
             this.Hitbox = Hitbox;
             this.Contact = Contact;
         }

         public async Execute<
             I extends EntityAttributes,
             K extends Entity<I>,
         >(entity: K, skill: Skill.Skill, gameMetadata: QuarrelGameMetadata = Dependency<QuarrelGameMetadata>()): Promise<HitData<Entity, Entity>>
         {
             const { Animator } = entity;
             const previousEntityState = [ EntityState.Idle, EntityState.Crouch ].includes(entity.GetState())
                 ? entity.GetState()
                 : EntityState.Idle;

             print("prev entity state:", previousEntityState);
             this.AttackSetup?.(entity);
             // assert(RunService.IsServer(), "Function is to be run on the server.");
             assert(this.Animation, "Builder incomplete! Animation not defined.");

             const animatorAnimation = Animator.LoadAnimation(this.Animation);
             const previousSkill = entity.attributes.PreviousSkill;
             const cachedPreviousSkill = previousSkill ? GetCachedSkill(previousSkill) : undefined;
             if (cachedPreviousSkill)
             {
                 const lastSkillAnimation = Animator.GetAnimator()
                     .GetPlayingAnimationTracks()
                     .find((t) => t.Animation?.AnimationId === cachedPreviousSkill.FrameData.Animation.assetId);

                 if (lastSkillAnimation)
                     lastSkillAnimation.Stop(0);
             }

             entity.attributes.PreviousSkill = skill.Id;
             return new Promise((res) =>
             {
                 const playAnimation = async () =>
                 {
                     /* TODO: make this take any scheduler instead of quarrelgame scheduler*/
                     const schedulerService = Dependency<SchedulerService>();
                     const waitFrames = async (frames: number) =>
                     {
                         const waiter = async () =>
                         {
                             for (let i = 0; i < frames; i++)
                                 await schedulerService.WaitForNextTick();
                         };

                         return waiter(); //Promise.any([ waiter(), Promise.fromEvent(animatorAnimation.Ended) ]);
                     };

                     if (this.StartupFrames > 0)
                     {
                         entity.SetState(EntityState.Startup);
                         await waitFrames(this.StartupFrames);
                         entity.ClearState(EntityState.Startup);
                     }

                     let attackDidLand = HitResult.Whiffed;
                     let onContact: RBXScriptConnection | void;

                     const activeHitbox = this.Hitbox.Initialize(entity.GetPrimaryPart(), skill);
                     entity.SetState(EntityState.Attack);
                     onContact = activeHitbox.Contact.Connect(({
                         Attacker,
                         Attacked,

                         AttackedIsBlocking,
                         Region,
                     }) =>
                     {
                         const setLandState = (result: HitResult): HitResult =>
                         {
                             if (result === HitResult.Counter)
                             {
                                 if (!skill.CanCounter)
                                     return attackDidLand = HitResult.Contact;
                             }
                             else if (result === HitResult.Contact)
                             {
                                 if (Attacked.CanCounter())
                                     return setLandState(HitResult.Counter);
                             }

                             return attackDidLand = result;
                         };

                         if (AttackedIsBlocking)
                         {
                             if (Attacked.IsState(EntityState.Crouch))
                             {
                                 if (Region === HitboxRegion.Overhead)
                                 {
                                     setLandState(HitResult.Contact);
                                     Attacked.SetHitStun(skill.FrameData.HitStunFrames * gameMetadata.CrouchStunMultiplier);
                                 }
                                 else
                                 {
                                     setLandState(HitResult.Blocked);
                                     Attacked.AddBlockStun(skill.FrameData.BlockStunFrames);
                                 }

                                 return res({
                                     hitResult: attackDidLand,
                                     attacker: entity,
                                     attacked: Attacked,
                                 });
                             }

                             if (Region === HitboxRegion.Low)
                             {
                                 setLandState(HitResult.Contact);
                                 Attacked.SetState(EntityState.Hitstun);
                             }
                             else
                             {
                                 setLandState(HitResult.Blocked);
                                 Attacked.AddBlockStun(skill.FrameData.BlockStunFrames);
                             }

                             return res({
                                 hitResult: attackDidLand,
                                 attacker: entity,
                                 attacked: Attacked,
                             });
                         }

                         Attacker.SetState(EntityState.Hitstun);
                         Attacked.SetHitStun(skill.FrameData.HitStunFrames);
                         setLandState(HitResult.Contact);
                         if (attackDidLand === HitResult.Counter)
                             Attacked.Counter(Attacker);
                         else
                             print("no Attacked");

                         return res({
                             hitResult: attackDidLand,
                             attacker: entity,
                             attacked: Attacked,
                         });
                     });

                     await waitFrames(this.ActiveFrames);
                     activeHitbox.Stop();
                     onContact = onContact?.Disconnect();
                     entity.ClearState(EntityState.Attack);

                     if (this.RecoveryFrames > 0)
                     {
                         if (attackDidLand !== HitResult.Whiffed)
                         {
                             let addedFrames = 0;
                             if (attackDidLand === HitResult.Blocked)
                                 addedFrames += this.BlockStunFrames;

                             return res({
                                 hitResult: attackDidLand,
                                 attacker: entity,
                             });
                         }

                         entity.SetState(EntityState.Recovery);
                         // await Promise.fromEvent(animatorAnimation.Ended);
                         // for (let i = 0; i < this.RecoveryFrames; i++)
                         // {
                         //     if (animatorAnimation.IsPlaying())
                         //         await schedulerService.WaitForNextTick();
                         // }
                         print("waiting frames");
                         await waitFrames(this.RecoveryFrames);
                         entity.ClearState(EntityState.Recovery);
                         print("done waiting");
                     }

                     if (animatorAnimation.IsPlaying())
                     {
                         return Promise.fromEvent(animatorAnimation.Ended)
                             .then(() =>
                                 res({
                                     attacker: entity,
                                     hitResult: attackDidLand,
                                 })
                             );
                     }

                     return res({
                         attacker: entity,
                         hitResult: attackDidLand,
                     });
                 };

                 task.spawn(() =>
                 {
                     animatorAnimation.Play({
                         FadeTime: 0,
                         // Weight: 4, - THIS CAN BREAK SHIT.
                     });
                 });

                 playAnimation();
             });
         }
     }

    export class FrameDataBuilder
    {
         private Startup = 0;

         private Active = 0;

         private Recovery = 0;

         private Contact = 0;

         private Block = 0;

         private HitStun = 0;

         private Animation?: Animation.AnimationData;

         private Hitbox?: Hitbox.Hitbox;

         /**
          * Set the startup frames of the Frame Data.
          * @param startup The amount of time for the attack to be active.
          */
         public SetStartup(startup: number)
         {
             this.Startup = startup;

             return this;
         }

         /**
          * Set the active frames of the Frame Data.
          * @param active The amount of frames the attack is active for.
          */
         public SetActive(active: number)
         {
             this.Active = active;

             return this;
         }

         /**
          * Set the amount of hitstun this attack will inflict.
          * @param active The amount of frames a contacted enemy will be stunned for.
          */
         public SetHitStun(stun: number)
         {
             this.HitStun = stun;

             return this;
         }

         /**
          * Set the recovery frames of the Frame Data.
          * @param recovery The amount of recovery frames the attack has.
          */
         public SetRecovery(recovery: number)
         {
             this.Recovery = recovery;

             return this;
         }

         /**
          * Set the amount of frames to be added to the Recovery frames
          * if the attack was blocked.
          * @param block The amount of frames added to recovery on block.
          */
         public SetBlock(block: number)
         {
             this.Block = block;

             return this;
         }

         /**
          * Set the Frame Data animation.
          * @param animation The new animation.
          */
         public SetAnimation(animation: Animation.AnimationData)
         {
             this.Animation = animation;

             return this;
         }

         /**
          * Set the new Frame Data hitbox.
          * @param hitbox The new {@link Hitbox.Hitbox Hitbox}.
          */
         public SetHitbox(hitbox: Hitbox.Hitbox)
         {
             this.Hitbox = hitbox;

             return this;
         }

         /**
          * Set the amount of contact frames for the Frame Data.
          * @param contact The amount of contact frames given to the Entity
          * if the attack lands while the target is neutral.
          */
         public SetContact(contact: number)
         {
             this.Contact = contact;

             return this;
         }

         /**
          * Turn this FrameDataBuilder instance into a readonly FrameData instance.
          * @returns {FrameData} The new readonly FrameData instance.
          */
         public Construct()
         {
             const { Active, Startup, Recovery, HitStun, Block: BlockStun, Animation, Hitbox, Contact } = this;
             assert(Animation, "Builder incomplete! Animation not defined.");
             assert(Hitbox, "Builder incomplete! Hitbox not defined.");

             return new FrameData({
                 Startup,
                 Recovery,
                 BlockStun,
                 HitStun,
                 Contact,
                 Active,
                 Animation,
                 Hitbox,
             });
         }
     }

    type SkillId = string;
    const allCachedSkills: Map<SkillId, Skill> = new Map();

    export function GetCachedSkill(skillId: SkillId): Skill | undefined
     {
         return allCachedSkills.get(skillId);
     }

    interface SkillClassProps
     {
         Name: string;

         Description: string;

         FrameData: FrameData;

         GroundedType: SkillGroundedType;

         IsReversal: boolean;

         CanCounter: boolean;

         GaugeRequired: number;

         Gatlings: Array<[MotionInput, SkillLike]>;

         SkillType: SkillType;

     }

     /**
      * A readonly Class of {@link SkillClassProps}.
      */
    export class Skill
    {
         constructor(
             destructorParams: SkillClassProps
         )
         {
             
             const { Name, Description, FrameData, GroundedType, IsReversal, CanCounter, GaugeRequired, SkillType, LinksInto } = destructorParams ?? this;

             this.Name = Name;
             this.Description = Description;
             this.FrameData = FrameData;
             this.GroundedType = GroundedType;
             this.IsReversal = IsReversal;
             this.CanCounter = CanCounter;
             this.GaugeRequired = GaugeRequired;
             this.Type = SkillType;

             allCachedSkills.set(this.Id, this);
         }

         /**
          * The ID of the skill.
          */
         public readonly Id = Identifier.Generate();

         /**
          * The name of the skill.
          */
         public readonly Name: string;

         /**
          * The Type of the skill.
          */
         public readonly Type: SkillType;

         /**
          * The description of the skill.
          */
         public readonly Description: string;

         /**
          * The frame data of the skill.
          * Determines how fast or slow the attacker
          * or defender can act out of an attack.
          */
         public readonly FrameData: FrameData;


         /**
          * Whether the skill is invulnerable
          * after frame 1. Disabling this on super moves
          * can allow for vulnerable supers.
          */
         public readonly IsReversal: boolean;

         /**
          * Whether this move can put an Entity
          * in the Counter state under the
          * right conditions.
          */
         public readonly CanCounter: boolean;

         /**
          * An Enum that determines whether the skill
          * can only be done {@link SkillGroundedType.Ground grounded}, {@link SkillGroundedType.AirOnly in the air only},
          * {@link SkillGroundedType.AirOk or both in the air and on the ground}.
          */
         public readonly GroundedType: SkillGroundedType;

         /**
          * How much gauge this skill requires to activate.
          */
         public readonly GaugeRequired: number;

         /**
          * The Skills that tkis Skill can cancel
          * into.
          */
         public readonly GatlingsInto = new Set<SkillId>();
         /**
          * Set the Skills that this Skill can
          * cancel into.
          */
         public AddGatling<NormalSkill extends Skill.Skill>(...skills: NormalSkill[])
         {
             assert(skills.every(({ Type }) => Type === SkillType.Normal), "skill is not a Normal skill");

             skills.forEach((skill) =>
             {
                 if (!this.GatlingsInto.has(skill.Id))
                     this.GatlingsInto.add(skill.Id);
             });

             return this;
         }
     }
    }

    export enum SkillGroundedType
     {
         Ground,
         AirOk,
         AirOnly,
     }

    export enum SkillType
     {
         Normal,
         Special,
         Super,
     }

    export class SkillBuilder
    {
         constructor(public readonly _SkillType: SkillType = SkillType.Normal)
         {}

         private Name?: string;

         private Description?: string = "";

         private FrameData?: FrameData;

         private GroundedType: SkillGroundedType = SkillGroundedType.Ground;

         private IsReversal = false;

         private CanCounterHit = true;

         private Gatlings: SkillClassProps["Gatlings"] = [];

         private GaugeRequired = 0;
         
         private LinksInto?: SkillLike;

         private followUps: Map<Input, SkillLike> = new Map();

         /**
          * Set the skill name.
          * @param name The new skill name.
          */
         public SetName(name: string)
         {
             this.Name = name;

             return this;
         }

         /**
          * Set the new description.
          * @param description The new description.
          */
         public SetDescription(description: string)
         {
             this.Description = description;

             return this;
         }

         /**
          * Set the frame data of the skill using a {@link FrameData} instance.
          * @param frameData A {@link FrameData} instance.
          */
         public SetFrameData(frameData: FrameData): this;
         /**
          * Set the frame data of the skill using a {@link FrameDataBuilder FrameDataBuilder} instance.
          * @param frameData A {@link FrameDataBuilder} instance.
          */
         public SetFrameData(frameData: FrameDataBuilder): this;
         public SetFrameData(frameData: FrameData | FrameDataBuilder)
         {
             if ("SetStartup" in frameData)
                 this.FrameData = frameData.Construct();
             else
                 this.FrameData = frameData;

             return this;
         }

         /**
          * Set the new grounded type of the skill.
          * @param groundedType The new {@link SkillGroundedType grounded type} of the skill.
          */
         public SetGroundedType(groundedType: SkillGroundedType = SkillGroundedType.Ground)
         {
             this.GroundedType = groundedType;

             return this;
         }

         /**
          * Set a follow-up skill.
          * @param input The input required to follow-up.
          * @param skill The skill to execute on follow-up.
          */
         public SetFollowUp(input: Input, skill: SkillLike)
         {
             if (this.followUps.has(input))
                 warn(`Skill ${this.Name} already has a follow up input (${input}). Overwriting.`);

             this.followUps.set(input, skill);

             return this;
         }

         /**
          * Set the Counter property of the Skill.
          * @param canCounter Whether the skill can initiate the counter-hit state.
          */
         public CanCounter(canCounter = true)
         {
             this.CanCounterHit = canCounter;

             return this;
         }

         /**
          * Set the skill's invulnerability after Frame 1.
          * @param isReversal Whether this skill is a Reversal.
          */
         public SetReversal(isReversal = false)
         {
             this.IsReversal = isReversal;

             return this;
         }

         /**
          * Set the amount of gauge required for the skill to activate.
          * @param gaugeRequired The amount of gauge required.
          */
         public SetGaugeRequired(gaugeRequired: number)
         {
             this.GaugeRequired = gaugeRequired;

             return this;
         }


         /**
          * Set whether this skill can be executed during the
          * previous skill's recovery phase, provided said 
          * previous skill has made contact with an entity.
          * @param skill The potential follow-up skill.
          */
         public CanGatlingInto(motion: MotionInput, skill: Skill.Skill)
         {
             this.Gatlings.push([motion, skill])

             return this;
         }

         /**
          * Construct the skill into a new readonly Skill instance.
          * @returns A new readonly Skill instance.
          */
         public Construct(): Skill
         {
             const { name, description, frameData, groundedType, motionInput, isReversal, canCounterHit, gaugeRequired, skillType, gatlings } = this;
             assert(name, "Builder incomplete! Name is unset.");
             assert(description !== undefined, "Builder incomplete! Description is unset.");
             assert(frameData, "Builder incomplete! Frame Data is unset.");
             assert(motionInput, "Builder incomplete! Motion input is unset.");

             return new Skill({
                 name,
                 description,
                 frameData,
                 groundedType,
                 motionInput,
                 isReversal,
                 canCounterHit,
                 gaugeRequired,
                 skillType,
                 gatlings,
             });
         }
     }
 }

export function validateGroundedState(skill: Skill.Skill | ((entity: Entity) => Skill.Skill), character: Entity)
{
    const outSkill = typeIs(skill, "function") ? skill(character) : skill;
    switch (outSkill.GroundedType)
    {
        case Skill.SkillGroundedType.AirOnly:
            return !character.IsGrounded();
        
        case Skill.SkillGroundedType.AirOk:
            return true;
        
        default:
            return character.IsGrounded();
    }
}

export default Character;
