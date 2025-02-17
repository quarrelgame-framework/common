import { Entity } from "components/entity.component";
import Character, { Skill, SkillLike, validateGroundedState } from "util/character";

/**
 * Holds information about an input and how long it was held for. 
*/
export type HeldInputDescriptor = [ inputBitFlag: number, inputHeldDuration: number | -1, inputChanged?: number ];
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
    Release = 0x4000,
    Press = 0x2000,
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
    Punch = 0x20,
    /* TODO: Turn into Normal2 */
    Kick = 0x40,
    /* TODO: Turn into Normal3 */
    Slash = 0x80,
    /* TODO: Turn into Normal4 */
    Heavy = 0x100,

    /* TODO: Turn into ComboExtender */
    Roman = 0x200,

    /* TODO: Turn into Special1 */
    Dust = 0x400,

    Dash = 0x800,
    Burst = 0x1000,
}

/**
 * A direction of movement.
 */
export enum Motion
{
                   Up = 0x02,
    Back = 0x04, Neutral = 0x01, Forward = 0x08,
                  Down = 0x10, 

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

export function IsMotionCardinal(number: Motion)
{
    return [Motion.Up, Motion.Down, Motion.Back, Motion.Forward].some((e) => (e & number) > 0)
}

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

/**
 * Gets the motion from an input state.
 */
export function GetMotionFromInputState(inputState: number): Motion | undefined
{
    let endMotion = 0x0000;
    // if we don't use cardinal directions
    // then diagonal inputs become included
    // and that's not good
    for (const [k, motion] of rawDirectionMap.filter(([,e]) => [Motion.Up, Motion.Down, Motion.Neutral, Motion.Back, Motion.Forward].includes(e))) 
    {
        if ((motion & inputState) > 0)

        {
            endMotion |= motion;
        }
    }
    return endMotion === 0 ? undefined : endMotion;
}

export function GetInputModeFromInputState(inputState: number): InputMode | undefined
{
    if ((inputState & InputMode.Up) > 0)

        return InputMode.Up;

    if ((inputState & InputMode.Down) > 0)

        return InputMode.Down;

    return undefined;
}

/**
 * Gets the input and the mode of the input from an input state.
 * The mode returns -1 if the Mode could not be found.
 * The function returns undefined if the Input could not be found.
 */
export function GetInputFromInputState(inputState: number): readonly [Input, InputMode | -1 ] | undefined
{
    let endInput = 0x0000;
    for (const [, maybeInput] of (Input as unknown as Map<keyof typeof Input, Input>))
    {
        if ((inputState & maybeInput) > 0)
        
            endInput |= maybeInput;

    }

    let endMode = 0x0000;
    if ((inputState & InputMode.Release) > 0)
    
        endMode = InputMode.Release;

    else if ((inputState & InputMode.Press) > 0)

        endMode = InputMode.Press

    else

        endMode = -1;

    return endInput ? [endInput, endMode] : undefined;
}

export function ConvertMotionToMoveDirection(motion: Motion): Vector3
{
    return rawDirectionMap.find(([, value]) => motion === value)?.[0] ?? Vector3.zero;
}

/**
* Converts a number representing an input state into a HeldInputDescriptor.
**/
export function standardizeMotion(input: number | (number | HeldInputDescriptor)[]): HeldInputDescriptor[]
{
    // return an 'instant' (-1) keypress if the input is a number
    return typeIs(input, "number") ? [[(input & ~InputMode.Release) | InputMode.Press, -1], [Motion.Neutral | InputMode.Release, DateTime.now().UnixTimestampMillis]] : input.map((e) => typeIs(e, "number") ? [((e & ~InputMode.Release) & ~InputMode.Press) === e ? e | InputMode.Press : e, -1] : e);
}

enum InputValidationType
{
    /*
     * If corner inputs are specified, then corner inputs will
     * be accounted for in the inputs. For example, both 236 and 26 
     * would have pass 236 pass, but 26 would not pass for 236.
     */
    ADAPTIVE,
    /*
     * The input given must be the exact same as the input stated.
     * 26 must be 26, not 236 or 4126.
     */
    STRICT,
}

export function validateMotion(_input: (number | HeldInputDescriptor)[], character: Pick<Character.Character, "Skills">, skillFetcherArguments: Parameters<Exclude<SkillLike, Skill.Skill>> = [], validationType = InputValidationType.ADAPTIVE)
{
    if (typeIs(_input, "number") || _input.some((e) => typeIs(e, "number")))

        return validateMotion(standardizeMotion(_input), character, skillFetcherArguments, validationType)
    
    // remove skills that are longer than the input list
    const validSkills = [];
    const skillsSimilarToMotion = 
        [...character.Skills]
            // .filter((motion) => motion.size() <= _input.size())
            .map((e) => typeIs(e[1], "function") ? [standardizeMotion(e[0]), e[1](...skillFetcherArguments)] : [standardizeMotion(e[0]), e[1]]) as readonly [MotionInput, Skill.Skill][];

    // if the skill does not have any .Release inputs or any
    // & 

    // iterate through all the skills' motion inputs in reverse order
    for (let [currentMotion, currentSkill] of skillsSimilarToMotion)
    {
        let input = [ ..._input ] as MotionInput;
        let inputDidPass = true;
        const unionChecker = ([v]: HeldInputDescriptor) => !!GetMotionFromInputState(v) && !!GetInputFromInputState(v)
        const motionHasCorners = currentMotion.some(([v]) => !IsMotionCardinal(v));
        const motionHasUnions = currentMotion.some(unionChecker)
        const motionHasReleases = currentMotion.some(([v]) => (v & InputMode.Release) > 0);
        const motionHasNeutrals = currentMotion.some(([v]) => v === (InputMode.Press | Motion.Neutral))

        
        const mapData = ([e]: HeldInputDescriptor): { mode: number, motion: number, input: number } => ({
                mode: GetInputModeFromInputState(e) ?? 0,
                motion: GetMotionFromInputState(e) ?? 0,
                input: GetInputFromInputState(e)?.[0] ?? 0,
        });

        const mapDataString = ({mode, motion, input}: ReturnType<typeof mapData>) => ({
                    mode: `${GetInputModeFromInputState(mode)} (raw ${mode})`,
                    motion: `${Motion[GetMotionFromInputState(motion) as Motion]} (raw ${motion})`,
                    input: `${Input[GetInputFromInputState(input)?.[0] as Input]} (raw ${input})`,
        });

        // if the motion input we're testing against has no
        // releases, then remove the releases for the motion 
        // we're testing for

        if (!motionHasNeutrals)

            input = input.filter((e) => e[0] !== (InputMode.Press | Motion.Neutral))

        // FIXME: if the corresponding motion does not have input-motion unions,
        // then remove all input-motion unions in the currentMotion
        // and just make them inputs
        if (!motionHasUnions)
        {
            // take all inputs, find their index, and just separate the input from the motion
            const inputsToProcess = input.filter((e) => unionChecker(e))
            
        }
            
        let i = currentMotion.size() - 1;
        let strippedInput = input.map(mapData).map((e) => e.motion | e.input);
        let strippedCurrentMotion = currentMotion.map(mapData).map((e) => e.motion | e.input)
        if (currentSkill.Name.match("Stop and Go")[0])
        {
            if (!motionHasReleases)
            {
                if (strippedInput.size() < strippedCurrentMotion.size())
                {
                    print(`skipped ${currentSkill.Name} because of unacceptable input length mismatch (${strippedCurrentMotion.size()} > ${strippedInput.size()})`)
                    inputDidPass = false;
                    continue;
                }

                i = strippedCurrentMotion.size() - 1;
                for (i; i > -1; i--)
                {
                    // we can just translate all inputs to motions because releases dont matter
                    const _ii = (strippedInput.size() - strippedCurrentMotion.size()) + i;
                    const inputIndex = _ii;

                    print(_ii, strippedInput.size(), strippedCurrentMotion.size())
                    
                    if ((strippedInput[inputIndex] & strippedCurrentMotion[i]) === strippedCurrentMotion[i])
                    {
                        warn("HELL YEAH", currentSkill.Name + ":", i, "passed:", inputIndex, strippedInput, strippedCurrentMotion);
                        continue;
                    } 
                    else 
                    {
                        const lastInputMapped = mapData([strippedInput[strippedInput.size() - 2]] as never)
                        const thisInputMapped = mapData([strippedInput[strippedInput.size() - 1]] as never)
                        const strippedMotionMapped = mapData([strippedCurrentMotion[i]] as never);
                        if (i === strippedCurrentMotion.size() - 1 && thisInputMapped.motion === Motion.Neutral)
                        {
                            if (strippedMotionMapped.motion === lastInputMapped.motion)
                            {
                                if (thisInputMapped.input === strippedMotionMapped.input)
                                {
                                    warn (i, "we recovered the fumble", currentSkill.Name);
                                    // correct the input for future use
                                    i -= 1;
                                    continue;
                                } 
                                else print("fumble F", i - 1, strippedCurrentMotion[i], thisInputMapped.input, lastInputMapped.input & strippedCurrentMotion[i], currentSkill.Name);
                            } 
                        } 
                    } 

                    inputDidPass = false;
                    const [ab,bb] = [strippedInput.map((e) => mapDataString(mapData([e] as never))), strippedCurrentMotion.map((e) => mapDataString(mapData([e] as never)))];
                    warn("HELL NO", currentSkill.Name + ":", ab[inputIndex], `(${inputIndex})`, bb[i], `(${i})`);

                    break;
                }
            } 
        }
        else 
        {
            inputDidPass = false;
        }



        // FIXME: make sure to compensate for inputs where people might do
        // 236 > 5S, which WOULD be valid for 236S but because they released
        // all their keys, it voids the input.
        // if (!moti

        // i need to mutate 'i' in this
        // block because if I need to be able
        // to skip indices while acting as if it
        // didn't exist
        // for (i; i > -1; i--)
        // {
        //     const [inputState, inputTime] = currentMotion[i];
        //     const _ii = (input.size() - currentMotion.size());
        //     const inputIndex = math.max(0, _ii);
        //
        //     switch (validationType)
        //     {
        //         case InputValidationType.ADAPTIVE:
        //         {
        //             /* falls through */
        //         }
        //
        //         case InputValidationType.STRICT:
        //         {
        //         }
        //     }
        // }

        if (inputDidPass)
        {
            warn("yay", currentSkill.Name, "passed", strippedInput, strippedCurrentMotion, input);
            validSkills.push([currentMotion, currentSkill] as const);
        }
        

    }

    return validSkills;
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
export function validateMotion_(input: (number | HeldInputDescriptor)[], character: Pick<Character.Character, "Skills">, maxHeat: number = 0, skillFetcherArguments?: [Entity, Entity[]]): (readonly [MotionInput, SkillLike])[]
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

            motionSet = set.filter((e, k, a) => !a[k-1] || !(a[k - 1][0] === Motion.Neutral && e[0] === Motion.Neutral)); // remove duplicates
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
