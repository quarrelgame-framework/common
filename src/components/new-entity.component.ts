import { BaseComponent, Component, Components } from "@flamework/components";
import { Dependency, OnRender, OnStart, OnTick } from "@flamework/core";
import { Players, RunService, Workspace } from "@rbxts/services";
import { Identifier } from "util/identifier";
import { BlockMode, EntityState, PhysicsDash, isStateAggressive, isStateCounterable, isStateNegative, isStateNeutral } from "util/lib";
import { StatefulComponent, StateAttributes } from "./state.component";
import type { Managed, ICharacter } from "@quarrelgame-framework/types";

import Visuals from "util/CastVisuals";
import { ConvertMotionToMoveDirection, Motion } from "util/input";
import { Animator } from "./animator.component";

enum RotationMode
{
    Unlocked,
    Locked,
}

const Fetcher = <T extends keyof CreatableInstances>(thisInstance: Instance, instanceName: string, instanceToCreate: T): Instances[T] => {
     if (RunService.IsServer())

        return thisInstance.FindFirstChild(instanceName) as Instances[T] ?? new Instance(instanceToCreate, thisInstance);

     return thisInstance.WaitForChild(instanceName) as Instances[T];
}

export interface EntityBaseAttributes extends StateAttributes {
    MaxHealth: number,
    Health: number,

    WalkSpeed: number

    EntityState: number,
}

export const EntityBaseDefaults = {
    MaxHealth: 100,
    Health: 100,

    WalkSpeed: 8,

    EntityState: EntityState.Idle,
}

@Component({
    defaults: EntityBaseDefaults
})
export abstract class EntityBase<A extends EntityBaseAttributes = EntityBaseAttributes, I extends ICharacter = Managed<ICharacter>> extends StatefulComponent<A, I> implements OnTick, OnStart {
    public readonly ControllerManager = Fetcher(this.instance.Humanoid, "ControllerManager", "ControllerManager")
    public readonly GroundSensor = Fetcher(this.instance.HumanoidRootPart, "GroundSensor", "ControllerPartSensor")
    public readonly ClimbSensor = Fetcher(this.instance.HumanoidRootPart, "ClimbSensor", "ControllerPartSensor");
    public readonly SwimSensor = Fetcher(this.instance.HumanoidRootPart, "SwimSensor", "BuoyancySensor");
    public readonly GroundController = Fetcher(this.ControllerManager, "GroundController", "GroundController");
    public readonly SwimController = Fetcher(this.ControllerManager, "SwimController", "SwimController");
    public readonly ClimbController = Fetcher(this.ControllerManager, "ClimbController", "ClimbController");
    public readonly AirController = Fetcher(this.ControllerManager, "AirController", "AirController");
    public readonly IKController: IKControl = Fetcher(this.instance.HumanoidRootPart, "IKController", "IKControl");
    public readonly Humanoid = this.instance.Humanoid;

    public readonly GroundOffsetMultiplier = 1;
    public readonly Animator: Animator.Animator;

    constructor()
    {
        super();
        const components = Dependency<Components>();
        const currentAnimator = components.getComponent<Animator.Animator>(this.instance);
        if (currentAnimator)

            this.Animator = currentAnimator

        else

            this.Animator = components.addComponent<Animator.Animator>(this.instance);
    }

    onStart()
    {
        debug.profilebegin("Entity Initialization")
        this.raycastParams.FilterType = Enum.RaycastFilterType.Exclude;
        this.raycastParams.AddToFilter([ this.instance, Workspace.CurrentCamera ?? this.instance ]);

        this.ControllerManager.GroundSensor = this.GroundSensor;
        this.ControllerManager.ClimbSensor = this.ClimbSensor;
        this.ControllerManager.RootPart = this.instance.PrimaryPart;
        this.ControllerManager.ActiveController = this.GroundController;

        this.GroundController.BalanceRigidityEnabled = true;
        this.AirController.BalanceRigidityEnabled = true;
        this.SwimController.BalanceRigidityEnabled = true;

        this.GroundSensor.SearchDistance = this.Humanoid.HipHeight * 1
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
        this.SenseGround();
    }


    onTick() {
        debug.profilebegin("Entity Management")
        let TotalMoveSpeedFactor = 1;
        if ((this.attributes.EntityState & EntityState.Crouch) > 0) {
            this.GroundController.GroundOffset = (this.Humanoid.HipHeight * 0.5) * this.GroundOffsetMultiplier;
            TotalMoveSpeedFactor -= 0.60;
        }
        else {
            this.GroundController.GroundOffset = this.Humanoid.HipHeight * this.GroundOffsetMultiplier;
            if ((this.attributes.EntityState & EntityState.Walk) > 0)

                TotalMoveSpeedFactor -= 0.40;
        }

        if (this.GroundSensor.SensedPart)

            if ((this.attributes.EntityState & EntityState.Midair) === 0)

                this.attributes.EntityState |= EntityState.Midair

            else if ((this.attributes.EntityState & EntityState.Midair) > 0)

                this.attributes.EntityState &= ~EntityState.Midair


        if (RunService.IsServer())
       
            this.Humanoid.EvaluateStateMachine = false;

        else       
        {
            if (this.GroundSensor.SensedPart && !this.GroundController.Active && this.Humanoid.GetState() !== Enum.HumanoidStateType.Jumping)
            {
                this.Humanoid.ChangeState(Enum.HumanoidStateType.Running);
                this.ControllerManager.ActiveController = this.GroundController;
            }
            else if ((!this.GroundSensor.SensedPart && !this.AirController.Active) || this.Humanoid.GetState() === Enum.HumanoidStateType.Jumping)
            {
                this.Humanoid.ChangeState(Enum.HumanoidStateType.Freefall);
                this.ControllerManager.ActiveController = this.AirController;
            }

            this.GroundController.MoveSpeedFactor = math.max(0, TotalMoveSpeedFactor);
        }

        debug.profileend()
    }

    public Crouch(crouchState: boolean = ((this.attributes.EntityState & EntityState.Crouch) > 0)) {

        if (crouchState)

            this.attributes.EntityState |= EntityState.Crouch;

        else

            this.attributes.EntityState &= ~EntityState.Crouch;
    }

    public Jump() {
        if (!this.GroundSensor.SensedPart)

            return;

        const jumpImpulse = new Vector3(0, this.instance.PrimaryPart.AssemblyMass * 50, 0);
        this.instance.PrimaryPart.ApplyImpulse(jumpImpulse);
        this.Humanoid.ChangeState(Enum.HumanoidStateType.Jumping);

        this.ControllerManager.ActiveController = this.AirController;
        this.GroundSensor.SensedPart?.ApplyImpulseAtPosition(jumpImpulse.mul(-1), this.GroundSensor.HitFrame.Position)
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
     * is currently doing.
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
        HitStop: -1,

        EntityId: "generate",
        State: EntityState.Idle,
    },
})
export class Entity<I extends EntityAttributes = EntityAttributes> extends EntityBase<I, Managed<ICharacter>> implements OnStart, OnTick
{
    constructor()
    { super(); }

    onStart()
    {
        const { EntityId } = this.attributes;
        this.attributes.EntityId = Identifier.GenerateComponentId(this, "EntityId");
    }

    onTick()
    {

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
     * Clears the entity's block stun.
     * Good for bursts and cancels.
     */
    public ClearBlockstun()
    {
        this.attributes.BlockStun = -1;
    }

    public async Dash(direction: Motion)
    {
        if (this.IsNegative())
            return Promise.resolve(false);

        if (!this.IsGrounded())
        {
            if (this.attributes.AirDashes <= 0|| this.attributes.AirOptions <= 0)

                return Promise.resolve(false);

            this.attributes.AirDashes -= 1;
            this.attributes.AirOptions -= 1;
        }

        this.ClearHitstop();
        const neutralMotionName: keyof typeof Motion = Motion[direction].match("Forward")[0] as "Forward" ?? Motion[direction].match("Back")[0] as "Back" ?? "Back";
        const maybePlayer = Players.GetPlayerFromCharacter(this.instance);
        const motionDirection = ConvertMotionToMoveDirection(this.attributes.CanEightWayDash ? direction : Motion[neutralMotionName]);

        return PhysicsDash(this.instance, motionDirection, undefined, false);
    }

    private rotationLocked = RotationMode.Unlocked;
    public LockRotation(rotationMode = RotationMode.Locked)
    {
        if (this.rotationLocked === rotationMode)
            return;

        this.Humanoid.AutoRotate = RotationMode.Locked ? false : true;
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

    private readonly facingLeniency = 0.725;
    // TODO: Important - Fix bug where dot product in Facing is incorrect leading to blocks being non-functional
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

    public CanJump()
    {
        if (!this.IsNegative())
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

    public IsNegative()
    {
        return isStateNegative(this.GetState());
    }

    public IsAttacked()
    {
        return this.IsState(
            EntityState.Hitstun,
            EntityState.Knockdown,
        );
    }

    public IsGrounded()
    {
        return !!this.GroundSensor.SensedPart
    }

    public GetPrimaryPart()
    {
        return this.instance.PrimaryPart;
    }
}
