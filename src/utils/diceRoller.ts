export interface ParsedDiceGroup {
    count: number;
    sides: number;
}

export interface ParsedFormula {
    dice: ParsedDiceGroup[];
    modifier: number;
    rawFormula: string;
}

export interface DiceRollGroup {
    sides: number;
    rolls: number[];
}

export interface RollResult {
    total: number;
    diceRolls: DiceRollGroup[];
    modifier: number;
    isNat1: boolean;
    isNat20: boolean;
    variant: "DEFAULT" | "ERROR" | "INFO" | "SUCCESS" | "WARNING";
    formattedText: string;
}

export interface EvaluateRollOptions {
    label?: string;
    roller?: (sides: number) => number;
}

/**
 * Parses dice formulas like "1d20+5", "2d6+3", "1d20-2", "8", "d20", "1d8+1d4+2".
 */
export function parseDiceFormula(formula: string): ParsedFormula {
    const rawFormula = (formula || "").trim();
    if (!rawFormula) {
        return { dice: [], modifier: 0, rawFormula };
    }

    const cleaned = rawFormula.replace(/\s+/g, '');
    const termRegex = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gi;
    const dice: ParsedDiceGroup[] = [];
    let modifier = 0;

    let match: RegExpExecArray | null;
    while ((match = termRegex.exec(cleaned)) !== null) {
        const [full, sign, countStr, sidesStr, staticStr] = match;
        if (!full) continue;
        const isNegative = sign === '-';

        if (sidesStr !== undefined) {
            const count = countStr ? parseInt(countStr, 10) : 1;
            const sides = parseInt(sidesStr, 10);
            if (count > 0 && sides > 0) {
                dice.push({ count, sides });
            }
        } else if (staticStr !== undefined) {
            const val = parseInt(staticStr, 10);
            modifier += isNegative ? -val : val;
        }
    }

    return {
        dice,
        modifier,
        rawFormula,
    };
}

/**
 * Evaluates a dice formula, rolls dice, checks for Nat 1/20, and formats the result.
 */
export function evaluateRoll(formula: string, options: EvaluateRollOptions = {}): RollResult {
    const { label, roller } = options;
    const parsed = parseDiceFormula(formula);

    const defaultRoller = (sides: number) => Math.floor(Math.random() * sides) + 1;
    const rollFn = roller || defaultRoller;

    const diceRolls: DiceRollGroup[] = [];
    let sum = 0;

    for (const group of parsed.dice) {
        const rolls: number[] = [];
        for (let i = 0; i < group.count; i++) {
            const val = rollFn(group.sides);
            rolls.push(val);
            sum += val;
        }
        diceRolls.push({ sides: group.sides, rolls });
    }

    const total = sum + parsed.modifier;

    // Check for Nat 1 or Nat 20 (only when rolling exactly a single d20)
    let isNat1 = false;
    let isNat20 = false;
    if (parsed.dice.length === 1 && parsed.dice[0].count === 1 && parsed.dice[0].sides === 20) {
        const d20Val = diceRolls[0]?.rolls[0];
        if (d20Val === 1) isNat1 = true;
        else if (d20Val === 20) isNat20 = true;
    }

    let variant: "DEFAULT" | "ERROR" | "INFO" | "SUCCESS" | "WARNING" = "DEFAULT";
    if (isNat20) variant = "SUCCESS";
    else if (isNat1) variant = "ERROR";

    // Format output text
    const prefix = label ? `${label}: ` : "Result of the roll: ";

    let formattedText = "";
    if (parsed.dice.length === 0) {
        // Static value only
        formattedText = `${prefix}${parsed.modifier}`;
    } else {
        const diceParts = parsed.dice.map((d, idx) => {
            const rollsStr = diceRolls[idx].rolls.join(", ");
            return `${rollsStr} (${d.count}d${d.sides})`;
        }).join(" + ");

        let modStr = "";
        if (parsed.modifier > 0) {
            modStr = ` + ${parsed.modifier}`;
        } else if (parsed.modifier < 0) {
            modStr = ` - ${Math.abs(parsed.modifier)}`;
        }

        const breakdown = `${diceParts}${modStr}`;
        formattedText = `${prefix}${breakdown} = ${total}`;
    }

    if (isNat20) {
        formattedText += "\nNat 20! 😎";
    } else if (isNat1) {
        formattedText += "\nNat 1 :(";
    }

    return {
        total,
        diceRolls,
        modifier: parsed.modifier,
        isNat1,
        isNat20,
        variant,
        formattedText,
    };
}
