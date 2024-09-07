import { BaseComponent, Component, Components } from "@flamework/components";
import { Dependency, OnPhysics, OnRender, OnStart, OnTick, Reflect } from "@flamework/core";
import { Players, RunService, Workspace } from "@rbxts/services";
import { Identifier } from "util/identifier";
import { BlockMode, EntityState, HitData, HitResult, PhysicsDash, isStateAggressive, isStateCounterable, isStateNegative, isStateNeutral } from "util/lib";
import { Motion } from "util/input";
import { StatefulComponent, StateAttributes } from "./state.component";
import type { ICharacter, ICharacterR6 } from "@quarrelgame-framework/types";

import Visuals from "util/CastVisuals";
import { Animator } from "./animator.component";
import { Debug } from "decorators/debug";
import { Skill, validateGroundedState } from "util/character";

import type CharacterManager from "singletons/character";
import type SkillManager from "singletons/skill";
import type { CharacterSetupFn } from "decorators/character";

enum RotationMode
{
    Unlocked,
    Locked,
}

const Fetcher = <T extends keyof CreatableInstances>(thisInstance: Instance, instanceName: string, instanceToCreate: T, allowClient?: boolean): Instances[T] => {
    const isServer = RunService.IsServer();
     if (isServer || allowClient)

        return (isServer ? thisInstance.FindFirstChild(instanceName) : thisInstance.WaitForChild(instanceName, 1.5)) as Instances[T] ?? new Instance(instanceToCreate, thisInstance);

     return thisInstance.WaitForChild(instanceName) as Instances[T];
}

export interface EntityBaseAttributes extends StateAttributes {
    MaxHealth: number,
    Health: number,

    WalkSpeed: number

    /*
     * Determines whether the entity should be
     * manipulated by the server or not.
     *
     * ⚠️ Changing this property also changes the 
     * ownership of the instance. Be careful.
     */
    IsServerEntity: boolean,
    State: number,
}

export const EntityBaseDefaults = {
    MaxHealth: 100,
    Health: 100,

    WalkSpeed: 8,

    IsServerEntity: false,
    State: EntityState.Idle,
}

@Component({
    defaults: EntityBaseDefaults
})
export abstract class EntityBase<A extends EntityBaseAttributes, I extends ICharacter> extends StatefulComponent<A, I> implements OnTick, OnStart, OnPhysics 
{
    public readonly ControllerManager = Fetcher(this.instance.Humanoid, "ControllerManager", "ControllerManager")
    public readonly GroundSensor = Fetcher(this.instance.HumanoidRootPart, "GroundSensor", "ControllerPartSensor", true)
    public readonly ClimbSensor = Fetcher(this.instance.HumanoidRootPart, "ClimbSensor", "ControllerPartSensor", true);
    public readonly SwimSensor = Fetcher(this.instance.HumanoidRootPart, "SwimSensor", "BuoyancySensor", true);
    public readonly GroundController = Fetcher(this.ControllerManager, "GroundController", "GroundController");
    public readonly SwimController = Fetcher(this.ControllerManager, "SwimController", "SwimController");
    public readonly ClimbController = Fetcher(this.ControllerManager, "ClimbController", "ClimbController");
    public readonly AirController = Fetcher(this.ControllerManager, "AirController", "AirController");
    public readonly IKController: IKControl = Fetcher(this.instance.HumanoidRootPart, "IKController", "IKControl");
    public readonly Humanoid = this.instance.Humanoid;

    public readonly GroundOffsetMultiplier = 1;
    public readonly Animator: Animator.StateAnimator;

    constructor()
    {
        super();
        const components = Dependency<Components>();
        const currentAnimator = components.getComponent<Animator.StateAnimator>(this.instance);
        if (currentAnimator)

            this.Animator = currentAnimator

        else

            this.Animator = components.addComponent<Animator.StateAnimator>(this.instance);

        if (!this.CanBeModified())
            
            this.Animator.Pause();
    }

    onStart()
    {
        debug.profilebegin("Entity Initialization")
        if (this.instance.Humanoid.HipHeight === 0)
        {
            if (this.Humanoid.RigType === Enum.HumanoidRigType.R15)

                warn("Humanoid hip height is set to zero on an R15 rig. Unable to calculate estimated hip height. Please set this manually.\n Expect undefined behavior.");

            else
            {
                warn("Humanoid hip height is set to zero on an R6 rig. Attempting to find correct hip height via legs. For better accuracy, try setting this manually.");

                const char: ICharacterR6 = this.instance as never;
                this.Humanoid.HipHeight = char["Left Leg"].Size.Y
            }
        }

        this.raycastParams.FilterType = Enum.RaycastFilterType.Exclude;
        this.raycastParams.AddToFilter([ this.instance, Workspace.CurrentCamera ?? this.instance ]);

        this.ControllerManager.GroundSensor = this.GroundSensor;
        this.ControllerManager.ClimbSensor = this.ClimbSensor;
        this.ControllerManager.RootPart = this.instance.PrimaryPart;
        this.ControllerManager.ActiveController = this.GroundController;

        this.GroundController.BalanceRigidityEnabled = true;
        this.AirController.BalanceRigidityEnabled = true;
        this.SwimController.BalanceRigidityEnabled = true;

        this.AirController.MoveMaxForce = 0;

        this.GroundSensor.SearchDistance = this.Humanoid.HipHeight * 1.05;
        this.GroundSensor.UpdateType = Enum.SensorUpdateType.Manual;
        this.GroundSensor.SensorMode = Enum.SensorMode.Floor;
        this.GroundSensor.Name = "GroundSensor";

        this.SwimSensor.UpdateType = Enum.SensorUpdateType.Manual;
        this.SwimSensor.Name = "SwimSensor";

        this.ClimbSensor.SearchDistance = 1.125;
        this.ClimbSensor.SensorMode = Enum.SensorMode.Ladder
        this.ClimbSensor.Name = "ClimbSensor";
        this.IKController.Name = "IKController";

        this.ControllerManager.BaseMoveSpeed = this.attributes.WalkSpeed;
        this.GroundController.GroundOffset = this.Humanoid.HipHeight * this.GroundOffsetMultiplier;
        this.Humanoid.WalkSpeed = this.attributes.WalkSpeed;
        this.Humanoid.Health = this.attributes.Health;
        this.Humanoid.MaxHealth = this.attributes.MaxHealth;

        this.onAttributeChanged("WalkSpeed", () => {
            this.Humanoid.WalkSpeed = this.attributes.WalkSpeed;
            this.ControllerManager.BaseMoveSpeed = this.attributes.WalkSpeed;
        })

        this.onAttributeChanged("Health", () => {
            this.Humanoid.Health = this.attributes.Health;
        })

        this.onAttributeChanged("MaxHealth", () => {
            this.Humanoid.MaxHealth = this.attributes.MaxHealth;
        })
    }

    onRender()
    {
        // unsure if this can even run on the server
        // or if it gets limited to the Heartbeat event,
        // but i don't want to try it.
    }


    onTick() {
        debug.profilebegin("Entity Management - Tick")
        this.Humanoid.EvaluateStateMachine = false;
        debug.profileend()
    }

    onPhysics()
    {
        debug.profilebegin("Entity Management - Physics")
        /* keep collision logic on-tick */
        if (this.CanBeModified())

            this.SenseGround();


        let TotalMoveSpeedFactor = 1;
        if (this.IsState(EntityState.Crouch)) 

            TotalMoveSpeedFactor = 0;

        else 

            if (this.IsState(EntityState.Sprint))

                TotalMoveSpeedFactor += 0.20;

        if (this.CanBeModified())
        {
            if (this.GroundSensor.SensedPart)
            {
                if ((this.attributes.State & EntityState.Midair) > 0)

                    this.attributes.State &= ~EntityState.Midair

            } else if ((this.attributes.State & EntityState.Midair) === 0)

                this.attributes.State |= EntityState.Midair

            if (this.GroundSensor.SensedPart && !this.GroundController.Active && this.Humanoid.GetState() !== Enum.HumanoidStateType.Jumping)
            {
                this.Humanoid.ChangeState(Enum.HumanoidStateType.Running);
                this.ControllerManager.ActiveController = this.GroundController;
            }
            else if ((!this.GroundSensor.SensedPart && !this.AirController.Active) || this.Humanoid.GetState() === Enum.HumanoidStateType.Jumping)
            {
                if (this.IsState(EntityState.Crouch))

                    this.Crouch(false)

                this.Humanoid.ChangeState(Enum.HumanoidStateType.Freefall);
                this.ControllerManager.ActiveController = this.AirController;
            }

            this.GroundController.MoveSpeedFactor = math.max(0, TotalMoveSpeedFactor);
        }

        debug.profileend()
    }

    public Crouch(crouchState: boolean = ((this.attributes.State & EntityState.Crouch) > 0)) {
        if (!this.CanBeModified())

            return;

        // print("lololololololololol", this.GetState(), crouchState)
        if (crouchState)
        {
            if (this.IsGrounded())
            {
                this.attributes.State |= EntityState.Crouch;
            }

        }
        else
        {
            this.attributes.State &= ~EntityState.Crouch;
        }
    }

    private jumpMultiplier = 50;
    public Jump() {
        if (!this.CanJump())

            return false;

        const { PrimaryPart } = this.instance;
        const { AssemblyMass } = PrimaryPart;
        let jumpImpulse = Vector3.zero;

        const { X, Z } = this.ControllerManager.MovingDirection;
        const directionMotion = new Vector3(math.sign(X), 1, math.sign(Z))

        if (!this.IsGrounded())
        {
            PrimaryPart.AssemblyLinearVelocity = new Vector3();
            jumpImpulse = directionMotion.mul(new Vector3(1,AssemblyMass,1));
        }
        else
        
            jumpImpulse = new Vector3(0, AssemblyMass);


        PrimaryPart.ApplyImpulse(jumpImpulse.mul(this.jumpMultiplier));
        this.Humanoid.ChangeState(Enum.HumanoidStateType.Jumping);
        this.GroundSensor.SensedPart?.ApplyImpulseAtPosition(jumpImpulse.mul(-this.jumpMultiplier), this.GroundSensor.HitFrame.Position)

        return true;
    }

    public CanJump()
    {
        return this.IsGrounded();
    }

    public CanBeModified()
    {
        return (RunService.IsServer() && this.attributes.IsServerEntity) || (RunService.IsClient() && !this.attributes.IsServerEntity)
    }

    private visL = new Visuals(BrickColor.random().Color);
    private visR = new Visuals(BrickColor.random().Color);
    protected raycastParams = new RaycastParams();
    protected ShootFloorRaycast(XOffset: number = 0): RaycastResult | undefined {
        const currentPivot = CFrame.lookAlong(this.instance.PrimaryPart.Position, this.ControllerManager.FacingDirection);
        const [p1, p2, p3] = [
            currentPivot.Position.add(currentPivot.RightVector.mul(XOffset)).add(this.instance.PrimaryPart.Size.mul(new Vector3(0,0.5,0))), 
            new Vector3(0, -math.abs(this.GroundSensor.SearchDistance) - this.Humanoid.HipHeight), 
            this.raycastParams
        ];

        if (XOffset < 0)

            this.visL.Raycast(p1,p2,p3)

        else

            this.visR.Raycast(p1,p2,p3)

        return Workspace.Raycast(p1,p2,p3);
    }

    public SenseGround()
    {
        const leftOffset = (this.instance.PrimaryPart.Size.X / 2) * 0.925 // L and R foot
        const [LRaycast, RRaycast] = [this.ShootFloorRaycast(leftOffset), this.ShootFloorRaycast(-leftOffset)];
        const heightRaycast = (LRaycast?.Distance ?? math.huge ) < (RRaycast?.Distance ?? math.huge) ? LRaycast : RRaycast
        const down = this.instance.GetPivot().UpVector.mul(-1);

        this.GroundSensor.SensedPart = heightRaycast?.Instance;
        this.GroundSensor.HitFrame = CFrame.lookAlong(heightRaycast?.Position ?? Vector3.zero, down);
        this.GroundSensor.HitNormal = heightRaycast?.Normal ?? down;
        
        return heightRaycast;
    }

    public IsGrounded()
    {
        return this.CanBeModified() ? !!this.GroundSensor.SensedPart : !!this.SenseGround();
    }

    // TODO: Important - Fix bug where dot product in Facing is incorrect leading to blocks being non-functional
    protected readonly facingLeniency = 0.725;
    public IsFacing(origin: Vector3, leniency = this.facingLeniency)
    {
        const { LookVector: normalizedFacing, Position: normalizedPosition } = this.instance
            .GetPivot()
            .sub(new Vector3(0, this.instance.GetPivot().Y, 0));
        const normalizedOrigin = origin.sub(new Vector3(0, origin.Y, 0));

        const dotArg = normalizedPosition.sub(normalizedOrigin).Unit;
        const dotProduct = normalizedFacing.Dot(dotArg);

        return dotProduct <= this.facingLeniency;
    }
    public GetPrimaryPart()
    {
        return this.instance.PrimaryPart;
    }
}

export interface EntityAttributes extends EntityBaseAttributes
{
    /**
     * The ID of the entity.
     */
    EntityId: string;
    /**
     * The maximum health of the entity.
     */
    MaxHealth: number;
    /**
     * The current health of the entity.
     */
    Health: number;

    /**
     * The amount of frames that the entity
     * is physically frozen for.
     *
     * When this integer is above 0, the entity's
     * current animation is stopped and they are
     * stuck in place for this many frames.
     */
    HitStop: number | -1;

    /**
     * The maximum amount of air options
     * an Entity can do.
     *
     * Especially useful for preventing infinite air combos.
     */
    MaxAirOptions: number;
    /**
     * The remaining amount of air dashes
     * the Entity has.
     */
    MaxAirDashes: number;
    /**
     * The remaining amount of jumps
     * the Entity has.
     */
    MaxAirJumps: number;
    /**
     * The remaining amount of air options
     * an Entity has remaining.
     *
     * Especially useful for preventing infinite air combos.
     */
    AirOptions: number;
    /**
     * The remaining amount of air dashes
     * the Entity has.
     */
    AirDashes: number;
    /**
     * The remaining amount of jumps
     * the Entity has.
     */
    AirJumps: number;

    /**
     * Whether the Entity can eight-way dash.
     */
    CanEightWayDash: boolean;

    /**
     * The maximum stamina of the Entity.
     */
    MaxStamina: number;
    /**
     * The current stamina of the Entity.
     */
    Stamina: number;

    /**
     * The maximum block stamina.
     * If the Entity runs out of block stamina, the
     * next hit will be guaranteed to be a counter-hit.
     */
    MaxBlockStamina: number;
    /**
     * The current block stamina.
     * If the Entity runs out of block stamina, the
     * next hit will be guaranteed to be a counter-hit.
     */
    BlockStamina: number;
    /**
     * The amount of block stun the Entity is in.
     * This will constantly reduce by 1 every in-game
     * tick (1/{@link SchedulerService.gameTickRate gameTickRate}).
     *
     * The Entity cannot make any inputs
     * while this value is above 0.
     */
    BlockStun: number | -1;
    /**
     * The amount of hit stun the Entity is in.
     * This will constantly reduce by 1 every in-game
     * tick (1/{@link SchedulerService.gameTickRate gameTickRate}).
     *
     * The Entity cannot make any inputs
     * while this value is above 0.
     */
    HitStun: number | -1;
    /**
     * The amount of invulnerability frames
     * the current Entity is in. In this state,
     * any hurtboxes present will not put the
     * character in a HitStun state.
     */
    IFrame: number | -1;

    /**
     * Whether the Entity was countered by a
     * skill. Should be the ID of the Entity
     * that attacked.
     *
     * If the Entity is hit by another Entity
     * that has the value of this Attribute,
     * this Entity will take more damage,
     * take more hitstun, and receive less
     * forgiveness by the Combo system.
     */
    Counter?: string;

    /**
     * The Id of the skill that the Entity
     * is/was doing.
     */
    PreviousSkill?: string;

    /**
     * The character representing this combatant.
     * Errors if the character is invalid.
     */
    CharacterId: string;

    /**
     * The match possessing this combatant.
     * Errors if the match is invalid.
     */
    MatchId: string;

    /**
     * The current State the Entity is in.
     */
    State: EntityState;
}

@Component({
    defaults: {
        ...EntityBaseDefaults,

        MaxHealth: 100,
        Health: 100,

        MaxStamina: 100,
        Stamina: 100,

        MaxBlockStamina: 100,
        BlockStamina: 100,

        MaxAirOptions: 2,
        MaxAirJumps: 1,
        MaxAirDashes: 1,

        AirOptions: -1,
        AirJumps: -1,
        AirDashes: -1,

        CanEightWayDash: false,

        IFrame: -1,
        BlockStun: -1,
        HitStun: -1,
        HitStop: -1,

        EntityId: "generate",
        State: EntityState.Idle,
    },
})
@Debug(["AirJumps", "AirOptions", "AirDashes", "EntityId"], (() => RunService.IsClient()))
export class Entity<I extends EntityAttributes = EntityAttributes> extends EntityBase<I, ICharacter> implements OnStart, OnTick, OnPhysics
{
    constructor(protected readonly CharacterManager: CharacterManager, protected readonly SkillManager: SkillManager)
    { super(); }

    onStart()
    {
        this.attributes.EntityId = Identifier.GenerateComponentId(this, "EntityId");
        this.onAttributeChanged("State", () =>
        {
            if (this.IsGrounded())
            {
                this.attributes.AirOptions = this.attributes.MaxAirOptions;
                this.attributes.AirJumps = this.attributes.MaxAirJumps;
            }

            if (this.IsNeutral())

                this.lastSkillHit = undefined;
        })

        const foundCharacter = this.CharacterManager.GetCharacter(this.attributes.CharacterId);
        if (foundCharacter)
        {
            const setup = Reflect.getMetadata(foundCharacter, "qgf.character.setup") as CharacterSetupFn | undefined
            setup?.(this.instance);
        }

        super.onStart();
    }

    onTick()
    {
        super.onTick();
        if (this.CanBeModified())
        {
            if (this.IsNegative())
            {
                this.ControllerManager.BaseMoveSpeed = 0;
                print("no move")
            }
            else 

                this.ControllerManager.BaseMoveSpeed = this.attributes.WalkSpeed;
        }

        if (this.attributes.HitStop > 0)

            this.attributes.HitStop -= 1;

        else if (this.IsState(EntityState.Hitstun))

            this.RemoveState(EntityState.Hitstun);

        if (this.attributes.BlockStun)

            this.attributes.BlockStun -= 1;

        this.ControllerManager.BaseTurnSpeed = 9.5;
    }

    /* TODO:
     * use a class decorator called QGFMetadata
     * and then use a shared singleton called
     * MetadataManager to allow the developer
     * to set their contact functions by class
     */

    /*
     * Fires when a skill the entity executed hits another
     * entity.
     */
    protected lastSkillHit?: Skill.Skill;
    public onSkillContact(contact: Entity, skill: Skill.Skill): HitResult | undefined
    {
        print("yuy i hit them");
        this.lastSkillHit = skill;
        return;
    }

    /*
     * Fires when a skill another entity executed hits this
     * entity.
     */
    public onSkillContacted(contacted: Entity, skill: Skill.Skill): HitResult | undefined
    {
        print("darn i got hit");
        this.SetState(EntityState.Hitstun);
        this.SetHitStun(skill.FrameData.HitStunFrames);

        if (this.IsBlocking(contacted.instance.GetPivot().Position))

            return HitResult.Blocked;

        return this.CanCounter() ? HitResult.Counter : HitResult.Contact;
    }

    public Rotate(towards: Vector3)
    {
        return this.Face(towards);
    }

    public FacePosition(position?: Vector3)
    {
        if (this.IsNegative())

            return;

        this.ControllerManager.FacingDirection = CFrame.lookAt(this.instance.GetPivot().Position, position ?? Vector3.zero).LookVector;
    }

    public Face(direction?: Vector3)
    {
        if (this.IsNegative())

            return;

        this.ControllerManager.FacingDirection = direction ?? Vector3.zero;
    }

    public SetHitstop(hitstop: number)
    {
        this.attributes.HitStop = hitstop;
    }

    public ClearHitstop()
    {
        this.attributes.HitStop = -1;
    }

    /**
     * Add block stun to the entity.
     * This does **not** set the block stun to the `blockStun` argument.
     * @param blockStun The block stun to add to the Entity.
     */
    public AddBlockStun(blockStun: number)
    {
        this.attributes.BlockStun += blockStun;
    }

    /**
     * Set the entity's hit stun.
     * @param hitStun The hit stun to give the Entity.
     */
    public SetHitStun(hitStun: number)
    {
        if (!this.IsState(EntityState.Hitstun) && hitStun > 0)

            this.SetState(EntityState.Hitstun);

        this.attributes.HitStun = hitStun;
    }

    public override Jump() {
        if (super.Jump())
        {
            if (!this.IsGrounded())
            {
                this.attributes.AirOptions -= 1;
                this.attributes.AirJumps -= 1;
            }

            return true;
        }
        else return false;
    }
    
    /**
     * Place the entity in their Counter sub-state
     * if the entity is currently being attacked.
     */
    public Counter<T extends EntityAttributes>(
        fromEntity: Entity<T>,
    )
    {
        if (
            this.IsState(
                EntityState.Hitstun,
                EntityState.Knockdown,
            )
        )
        {
            if (!this.attributes.Counter)
                this.attributes.Counter = fromEntity.attributes.EntityId;
        }
    }

    /**
     * Execute a skill.
     *
     * Skills can be canceled into
     */
    public async ExecuteSkill(skillPriorityList: (Skill.Skill["Id"])[])
    {
        const currentCharacter = this.CharacterManager.GetCharacter(this.attributes.CharacterId);
        assert(currentCharacter, "current character is undefined");

        return new Promise<HitData<Entity, Entity>>(async (res, rej) => 
        {
            const unwrapper: (<T>(e: [object, T | ((e: Entity) => T)]) => T) = ((e) => (typeIs(e[1], "function") ? e[1](this) : e[1]));
            const previousSkill = this.SkillManager.GetSkill(this.attributes.PreviousSkill ?? tostring({}));
            const gatlingSkills = this.lastSkillHit?.Gatlings.map(unwrapper).filter((e) => skillPriorityList.includes(e.Id)) ?? []
            const rekkaSkills = previousSkill?.Rekkas.map(unwrapper).filter((e) => skillPriorityList.includes(e.Id)) ?? []

            return Promise.resolve([...[...gatlingSkills, ...rekkaSkills].map((e) => e.Id), ...skillPriorityList].mapFiltered((skillId) =>
            {
                const processedAttacks = [...currentCharacter.Skills].map(unwrapper);
                for (const skill of [...rekkaSkills, ...gatlingSkills, ...processedAttacks,])
                {
                    if (skill.Id === skillId)
                    {
                        const isGatlingSkill = gatlingSkills.includes(skill);
                        const isRekkaSkill = rekkaSkills.includes(skill);

                        if (this.IsNegative())
                        {
                            if (this.WasAttacked())
                            {
                                return;
                            }
                            else if (!isGatlingSkill)
                            {
                                if (isRekkaSkill)

                                    if (this.IsState(EntityState.Recovery))

                                        return;
                            }
                            else return;
                        } 
                        

                        if (validateGroundedState(skill, this))

                            return skill;
                    }
                }

                return undefined;
            })).then((skills) => skills[0]).then((skill) => skill?.FrameData.Execute(this, skill).then(res).catch(rej))
        });
    }

    /**
     * Clears the entity's block stun.
     * Good for bursts and cancels.
     */
    public ClearBlockstun()
    {
        this.attributes.BlockStun = -1;
    }

    public async Dash()
    {
        if (this.IsNegative(!!this.lastSkillHit))
            return Promise.resolve(false);

        if (!this.IsGrounded())
        {
            if (this.attributes.AirDashes <= 0|| this.attributes.AirOptions <= 0)

                return Promise.resolve(false);

            this.attributes.AirDashes -= 1;
            this.attributes.AirOptions -= 1;
        }

        this.ClearHitstop();
        return PhysicsDash(this.instance, this.ControllerManager.MovingDirection, undefined, false);
    }

    private rotationLocked = RotationMode.Unlocked;
    public LockRotation(rotationMode = RotationMode.Locked)
    {
        if (this.rotationLocked === rotationMode)
            return;

        this.rotationLocked = rotationMode;
    }

    public UnlockRotation()
    {
        this.LockRotation(RotationMode.Unlocked);
    }

    // TODO: Implement a global state that allows developers to swap between
    // blocking through a blocking state or through move direction.
    public IsBlocking(
        damageOrigin: Vector3,
        blockMode: BlockMode = BlockMode.MoveDirection
    )
    {
        if (this.IsFacing(damageOrigin))
        {
            // print("is facing damage origin");
            if (blockMode === BlockMode.MoveDirection)
            {
                // print("movedirection-based blocking");
                const { MoveDirection } = this.Humanoid;
                const dotProduct = MoveDirection.Dot(
                    damageOrigin
                        .mul(new Vector3(1, 0, 1))
                        .sub(MoveDirection.mul(new Vector3(1, 0, 1))).Unit,
                );
                print("facing:", dotProduct, MoveDirection.Magnitude);

                if (dotProduct >= this.facingLeniency)
                    return true;

                return false;
            }

            if (this.IsState(EntityState.Block))
                return true;
        }

        print("not facing");

        return false;
    }

    public override CanJump()
    {
        if (!this.IsNegative(!!this.lastSkillHit))
            if (this.IsGrounded())
                return !this.IsState(EntityState.Jumping);
            else
                return this.attributes.AirOptions > 0 && this.attributes.AirJumps > 0;
        else return false;
        // if sandwich?! O_O
    }

    public CanCounter()
    {
        return isStateCounterable(this.GetState());
    }

    public IsAttacking()
    {
        return isStateAggressive(this.GetState());
    }

    public IsNeutral()
    {
        return isStateNeutral(this.GetState());
    }

    public IsNegative(excludeRecovery?: boolean)
    {
        return isStateNegative(this.GetState(), excludeRecovery ? EntityState.Recovery & EntityState.Attack : []) || this.attributes.BlockStun > 0 || this.attributes.HitStun > 0;
    }

    public WasAttacked()
    {
        return this.IsState(
            EntityState.Hitstun,
            EntityState.Knockdown,
        );
    }

    public override Crouch(crouchState: boolean)
    {
        if (isStateNegative(this.attributes.State))

            return

        super.Crouch(crouchState)
    }

}
