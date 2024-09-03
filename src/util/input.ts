import Character, { Skill } from "util/character";

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
    Release = Enum.UserInputState.End.Value,
    Press = Enum.UserInputState.Begin.Value,
    Up = InputMode["Release"],
    Down = InputMode["Press"],
}

/**
 * Whether the input was allowed
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
    Dash = "DS",
    Dust = "DT",
    Sweep = "SP",

    Punch = "P",
    Kick = "K",
    Slash = "S",
    Heavy = "HS",

    Roman = "RC",
    Burst = "BR",
}

/**
 * A direction of movement.
 */
export enum Motion
{
    DownBack = 1,
    Down = 2,
    DownForward = 3,
    Back = 4,
    Neutral = 5,
    Forward = 6,
    UpBack = 7,
    Up = 8,
    UpForward = 9,
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

/**
 * Search `character`'s skills and return an array of
 * all skills that are similar to `motion`, sorted
 * by heat and filtering non-correlating entries.
 *
 * TODO: Check for general cardinal direction navigation by
 * looking for specific directions within the non-cardinal
 * directions (S/NW, S/NE), DownLeft should qualify for Down and Left.
 */
export function validateMotion(input: (Motion | Input)[], character: Character.Character, maxHeat: number = 0): (readonly [MotionInput, Skill.Skill | (() => Skill.Skill)])[]
{
    const currentMotion = [ ...input ];
    const decompiledAttacks = [...character.Attacks]
    const matchingAttacks = decompiledAttacks.filter(([motionInput]) => 
    {
        let motionSet: MotionInput;
        if ( motionInput.includes(Motion.Neutral) ) 
        {
            const set = [ ... currentMotion ];
            if (set[0] !== Motion.Neutral)

                set.unshift(Motion.Neutral); // make sure the motion starts with 5 if it doesn't already

            motionSet = set.filter((e, k, a) => !(a[k - 1] === Motion.Neutral && e === Motion.Neutral)); // remove duplicates
        }
        else

            motionSet = currentMotion.filter((e) => e !== Motion.Neutral); // filter all neutrals 

        if (motionSet.size() < motionInput.size())

            return;

             
        if (motionSet.size() === 0)

            return;

        for (let i = motionInput.size() - 1; i >= 0; i--)

            if (motionInput[i] !== motionSet[motionSet.size() - (motionInput.size() - i)])

                // print(`motion failed: ${motionInput[i]} !== ${motionSet[i]}`);
                return false;


        // print(`motion passed: ${this.stringifyMotionInput(motionInput)} === ${this.stringifyMotionInput(motionSet)}`);
        return true;
    });

    return matchingAttacks.filter((e) => typeIs(e[1], "function") ? e[1]().GaugeRequired <= maxHeat : e[1].GaugeRequired <= maxHeat);
}

export function stringifyMotionInput(motionInput: MotionInput)
{
    return motionInput.size() > 0 ? motionInput.map(tostring).reduce((acc, v) => `${acc}, ${v}`) : ""
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
    return primaryInput !== Motion.Neutral && primaryInput && inputs[motionSize - 3] === primaryInput && inputs[motionSize - 4]
}

export type MotionInput = Array<Motion | Input>;
