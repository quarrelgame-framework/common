import { Controller, Service } from "@flamework/core";

export enum ComboScalingType {
    /*
     * The deeper a player
     * is in their combo,
     * the faster their opponent
     * will fall to the floor.
     */
    Gravity = 0x1,
    /*
     * The deeper a player
     * is in their combo, the less
     * damage their opponent will take.
     */
    Damage = 0x2,
    /* The deeper a player
     * is in their combo, the farther
     * their opponent will be knocked
     * in the opposite direction of the
     * attack vector.
     */
    Knockback = 0x3,
}

@Controller({})
@Service({})
export class QuarrelGameMetadata {
    /*
     * The hitstun multiplier that
     * a player will receive when 
     * they are attacked while 
     * crouching.
     */
    public CrouchStunMultiplier: number = 1.25;

    /* The hitstun multiplier that
     * a player will receive when they
     * are attacked whilst in the
     * Counter state.
     */
    public CounterStunMultiplier: number = 1.6275;

    /* Whether the benefits of a 
     * counter-hit are shared between
     * several entities or not. */
    readonly CounterShareEntities: boolean = false;

    /* Whether the benefits of a
     * counter-hit can be reaped
     * by entities provided that
     * they achieve a counter hit
     * as well. */
    readonly CounterAllowMultiple: boolean = false;

    /*
     * Combo scaling values. 
     * These are computed every tick.
     *
     * Set to zero to disable.
     */
    readonly ComboScaling: {readonly [K in keyof ComboScalingType[keyof ComboScalingType]]: number} = {
        [ComboScalingType.Knockback]: 0,
        [ComboScalingType.Damage]: 0,
        [ComboScalingType.Gravity]: 0,
    } as const;
}

export default QuarrelGameMetadata;
