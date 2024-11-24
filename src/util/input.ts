import { Entity } from "components/entity.component";
import Character, { SkillLike } from "util/character";

/**
 * Holds information about an input and how long it was held for. 
*/
export type HeldInputDescriptor = [ inputBitFlag: number, inputHeldDuration: number ];

/**
 * The medium the User is using
 * to interact with the client.
 */
export enum InputType
{
    Gamepad,
    MouseKeyboard,
}

/**
 * The state of an input.
 */
export enum InputMode
{
    Release = 0x800,
    Press = 0x1000,
    Up = Release,
    Down = Press,
}

/** Whether the input was allowed
 * or denied.
 */
export enum InputResult
{
    Success = Enum.ContextActionResult.Sink.Value,
    Fail = Enum.ContextActionResult.Pass.Value,
}

/**
 * Whether an input was processed by the
 * game client.
 */
export enum InputProcessed
{
    Processed,
    Unprocessed,
    Either,
}

/**
 * A directional input.
 */
export type CommandNormal = [Motion, Input];

/**
 * An input that translates to an attack in the game.
 */
export enum Input
{
    /* TODO: Turn into Normal1 */
    Punch = 0x10,
    /* TODO: Turn into Normal2 */
    Kick = 0x20,
    /* TODO: Turn into Normal3 */
    Slash = 0x40,
    /* TODO: Turn into Normal4 */
    Heavy = 0x80,

    /* TODO: Turn into ComboExtender */
    Roman = 0x100,

    /* TODO: Turn into Special1 */
    Dust = 0x400,

    Dash = 0x800,
    Burst = 0x200,
}

/**
 * A direction of movement.
 */
export enum Motion
{
                   Up = 0x02,
    Back = 0x04, Neutral = 0x01, Forward = 0x06,
                  Down = 0x08, 

    UpBack = Up | Back, UpForward = Up | Forward,
    DownBack = Down | Back, DownForward = Down | Forward
}

const rawDirectionMap: (readonly [Vector3, Motion])[] = ([
    [ new Vector3(0, 0.5), Motion.Up ],
    [ new Vector3(0.5, 0.5), Motion.UpForward ],
    [ new Vector3(-0.5, 0.5), Motion.UpBack ],
    [ new Vector3(0, -0.5), Motion.Down ],
    [ new Vector3(0.5, -0.5), Motion.DownForward ],
    [ new Vector3(-0.5, -0.5), Motion.DownBack ],
    [ new Vector3(0, 0), Motion.Neutral ],
    [ new Vector3(0.5, 0), Motion.Forward ],
    [ new Vector3(-0.5, 0), Motion.Back ],
] as const).map((n) => [ n[0], n[1] ]);

const moveDirectionMap: typeof rawDirectionMap = rawDirectionMap.map((n) => [ n[0].Unit, n[1] ]);

export function ConvertMoveDirectionToMotion(moveDirection: Vector3): readonly [motion: keyof typeof Motion, dot: number]
{
    moveDirection = new Vector3(moveDirection.X, moveDirection.Y, -moveDirection.Z);
    const closest = moveDirectionMap.map(([ vector, motion ]) =>
    {
        const dotCurr = vector.Dot(moveDirection.Unit);

        return [ Motion[motion], dotCurr ] as const;
    }).filter(([ , dot ]) => dot > 0).sort(([ , a ], [ , b ]) => a < b)
        .reduce((acc, cur) =>
        {
            const [ , dot ] = cur;
            if (dot > acc[1])
                return cur;

            return acc;
        }, [ Motion[Motion.Neutral], 0 ] as readonly [string, number]);

    return closest as never;
}

export function ClampDirectionToMotions(direction: Vector3, ...motions: Motion[])
{
    return motions.map(ConvertMotionToMoveDirection).filter((e) => e.Magnitude > 0 && math.sign(e.Dot(direction)) > 0);
}

export function ConvertMotionToMoveDirection(motion: Motion): Vector3
{
    for (const [ moveDirection, value ] of rawDirectionMap)
    {
        if (motion === value)
            return moveDirection;
    }

    return Vector3.zero;
}

function temporarySwap(array: unknown[])
{
    let left = undefined;
    let right = undefined;
    const length = array.size();
    for (left = 0, right = length - 1; left < right; left += 1, right -= 1)
    {
        const temporary = array[left];
        array[left] = array[right];
        array[right] = temporary;
    }

    return array;
}

export function standardizeMotion(input: (number | HeldInputDescriptor)[]): HeldInputDescriptor[]
{
    return input.map((e) => typeIs(e, "number") ? [e, -1] : e);
}

/**
 * Search `character`'s skills and return an array of
 * all skills that are similar to `motion`, sorted
 * by heat and filtering non-correlating entries.
 *
 * TODO: Check for general cardinal direction navigation by
 * looking for specific directions within the non-cardinal
 * directions (S/NW, S/NE), DownLeft should qualify for Down and Left.
 */
export function validateMotion(input: (number | HeldInputDescriptor)[], character: Pick<Character.Character, "Skills">, maxHeat: number = 0, skillFetcherArguments?: [Entity, Entity[]]): (readonly [MotionInput, SkillLike])[]
{
    const currentMotion = standardizeMotion(input);
    const decompiledAttacks = [...character.Skills].map(([a,b]) => [standardizeMotion(a), b]) as [MotionInput, SkillLike][];
    if ((currentMotion[0][0] & Motion.Neutral) === 0)
    
        currentMotion.unshift([Motion.Neutral, -1]);
    
    print("character skills:", character.Skills);
    const matchingAttacks = decompiledAttacks.map(([a,b]) => {
        if (typeIs(b, "function"))
        {
            if (skillFetcherArguments)
            {
                const [ thisEntity, entityList ] = skillFetcherArguments;
                return [a,b(thisEntity, new Set(entityList))] as const;
            }

            return [a, b()] as const;
        }

        return [a,b] as const;
    }).filter(([motionInput, skillLike]) => 
    {
        let motionSet: HeldInputDescriptor[];
        // if the attack inputs provided by the character
        // specify a neutral, then prefix the move with
        // neutral.
        if (motionInput.find((e) => e[0] === Motion.Neutral))
        {
            const set = [ ... currentMotion ];
            if (set[0][0] !== Motion.Neutral)

                set.unshift([Motion.Neutral, -1]); // make sure the motion starts with 5 if it doesn't already

            motionSet = set.filter((e, k, a) => !(a[k - 1][0] === Motion.Neutral && e[0] === Motion.Neutral)); // remove duplicates
        }
        else

            // TODO: only remove neutrals that aren't specified in the motion set
            motionSet = currentMotion.filter((e) => e[0] !== Motion.Neutral); // filter all neutrals 

        if (motionSet.size() < motionInput.size())
        {
            print(`Motion set for skill ${skillLike.Name} is shorter (${motionSet.size()}) than the queued motion input (${motionInput.size()}). Skipping.`);
            return false;
        }

             
        if (motionSet.size() === 0)
        {
            print(`Motion set for skill ${skillLike.Name} is zero.`);
            return;
        }

        // run the motion input in reverse
        // because extra motions / inputs
        // might have been queued
        for (let i = motionInput.size() - 1; i >= 0; i--)
        {
            // TODO: have some form of input leniency here by checking some kind of environment variabled
            // if leniency is on, check if the user's input contains the motion set input 
            // (so the user's DownLeft would pass for Down UNLESS the next input is down)
            //  
            // otherwise, just do direct comparison
            //
            const previousIndex = motionSet.size() - (motionInput.size() - i);
            if ((motionInput[i][0] & motionSet[previousIndex][0]) === 0) // lenient case
            {
                print(`motion failed: ${motionInput[i][0]} !& ${motionSet[previousIndex][0]}`);
                return false;
            } else if (motionSet[i - 1] && (motionSet[i - 1][0] & motionSet[i][0]) > 0)
            {
                print(`motion failed: input leniency would have passed this, but ${motionSet[i - 1][0]} goes into ${motionSet[i][0]}.`)
                return false;
            }

            if (motionSet[i][1] > motionInput[i][1])
            {
                print(`motion failed: input was not held for long enough (${motionInput[i][1]}ms out of ${motionSet[i][1]}ms`);
                return false;
            }
        }

        print(`motion passed: ${stringifyMotionInput(motionInput)} === ${stringifyMotionInput(motionSet)}`);
        return true;
    });

    const output = matchingAttacks.filter((e) => e[1].GaugeRequired <= maxHeat);
    print("output:", output);
    return output;
}

export function stringifyMotionInput(motionInput: MotionInput)
{
    return motionInput.size() > 0 ? motionInput.map((e) => `{${e[0]}, ${e[1]}}`).reduce((acc, v) => `${acc}, ${v}`) : ""
}


export const isCommandNormal = (attack: unknown[]): attack is [Motion, Input] => !!(Motion[attack[0] as Motion] && Input[attack[1] as never]) && attack.size() === 2;
export function isInput(input: unknown): input is Input
{
    return !!Input[input as never];
}

export function GenerateRelativeVectorFromNormalId(
    relativeTo: CFrame,
    normal: Enum.NormalId,
)
{
    return relativeTo.VectorToWorldSpace(Vector3.FromNormalId(normal));
}

export function isCurrentMotionDashInput(
    inputs: MotionInput
)
{
    const motionSize = inputs.size()
    if (motionSize < 4)
        return false;

    const primaryInput = inputs[motionSize - 1];
    return primaryInput[0] !== Motion.Neutral && primaryInput && inputs[motionSize - 3][0] === primaryInput[0] && inputs[motionSize - 4]
}

export type MotionInput = Array<HeldInputDescriptor>;
