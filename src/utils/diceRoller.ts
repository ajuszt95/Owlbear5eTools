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

export type Advantage = "normal" | "adv" | "dis";

export interface RollResult {
    total: number;
    diceRolls: DiceRollGroup[];
    modifier: number;
    isNat1: boolean;
    isNat20: boolean;
    /** The dice retained for the total; differs from diceRolls for adv/dis rolls. */
    keptRolls: number[];
    advantage: Advantage;
    variant: "DEFAULT" | "ERROR" | "INFO" | "SUCCESS" | "WARNING";
    formattedText: string;
}

export interface EvaluateRollOptions {
    label?: string;
    roller?: (sides: number) => number;
    advantage?: Advantage;
}

const SINGLE_D20_FORMULA = /^\s*(?:1)?d20\s*([+-]\s*\d+)?\s*$/i;

/** Returns true only for a standalone d20 roll with an optional numeric modifier. */
export function isSingleD20Formula(formula: string): boolean {
    return SINGLE_D20_FORMULA.test(formula || "");
}

/**
 * Converts a standalone d20 formula into Dice+'s keep-highest/lowest notation.
 * Other formulas are deliberately returned unchanged so damage rolls cannot gain
 * advantage notation by accident.
 */
export function applyAdvantageNotation(formula: string, advantage: Advantage): string {
    if (advantage === "normal" || !isSingleD20Formula(formula)) return formula;

    const modifier = (formula.match(SINGLE_D20_FORMULA)?.[1] || "").replace(/\s+/g, "");
    return `2d20${advantage === "adv" ? "kh1" : "kl1"}${modifier}`;
}

/** Doubles every dice group in a valid dice formula while preserving its modifier. */
export function critFormula(formula: string): string {
    const cleaned = (formula || "").replace(/\s+/g, "");
    if (!cleaned || !/^[+-]?(?:(?:\d*)d\d+|\d+)(?:[+-](?:(?:\d*)d\d+|\d+))*$/i.test(cleaned)) {
        return formula;
    }

    const parsed = parseDiceFormula(cleaned);
    if (parsed.dice.length === 0) return formula;

    const dice = parsed.dice.map(({ count, sides }) => `${count * 2}d${sides}`).join("+");
    if (parsed.modifier === 0) return dice;
    return `${dice}${parsed.modifier > 0 ? "+" : "-"}${Math.abs(parsed.modifier)}`;
}

/**
 * Extracts the kept d20 value from a Dice+ `roll-result` payload.
 * Dice+ reports per-group dice with `kept` flags (e.g. 2d20kh1 advantage
 * keeps one, drops one) — the kept die decides Nat20/Nat1, mirroring
 * Basic's kept-die rule. Returns null when no d20 is present.
 * Accepts the raw broadcast event, the unwrapped payload, or the groups array.
 */
export function keptD20FromDicePlus(eventOrPayload: unknown): number | null {
    const wrapper = eventOrPayload as { data?: unknown } | undefined;
    const p = (wrapper?.data ?? eventOrPayload) as any;
    const groups = p?.result?.groups ?? p?.groups ?? (Array.isArray(p) ? p : undefined);
    if (!Array.isArray(groups)) return null;
    for (const g of groups) {
        const dice = (g as any)?.dice;
        if (!Array.isArray(dice)) continue;
        const groupType = (g as any)?.diceType;
        const d20s = dice.filter((d: any) => d?.diceType === 'd20' || groupType === 'd20');
        if (d20s.length === 0) continue;
        const kept = d20s.find((d: any) => d?.kept === true) ?? d20s[0];
        if (typeof kept?.value === 'number') return kept.value;
    }
    return null;
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
    const { label, roller, advantage: requestedAdvantage = "normal" } = options;
    const parsed = parseDiceFormula(formula);
    const advantage = isSingleD20Formula(formula) ? requestedAdvantage : "normal";

    const defaultRoller = (sides: number) => Math.floor(Math.random() * sides) + 1;
    const rollFn = roller || defaultRoller;

    const diceRolls: DiceRollGroup[] = [];
    let sum = 0;

    const keptRolls: number[] = [];
    for (const group of parsed.dice) {
        const rolls: number[] = [];
        const rollCount = advantage !== "normal" && group.count === 1 && group.sides === 20 ? 2 : group.count;
        for (let i = 0; i < rollCount; i++) {
            const val = rollFn(group.sides);
            rolls.push(val);
        }
        const kept = advantage === "adv" ? Math.max(...rolls)
            : advantage === "dis" ? Math.min(...rolls)
                : rolls.reduce((total, value) => total + value, 0);
        sum += kept;
        keptRolls.push(...(advantage === "normal" ? rolls : [kept]));
        diceRolls.push({ sides: group.sides, rolls });
    }

    const total = sum + parsed.modifier;

    // Check for Nat 1 or Nat 20 (only when rolling exactly a single d20)
    let isNat1 = false;
    let isNat20 = false;
    if (parsed.dice.length === 1 && parsed.dice[0].count === 1 && parsed.dice[0].sides === 20) {
        const d20Val = keptRolls[0];
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
            const count = advantage !== "normal" && idx === 0 ? 2 : d.count;
            const annotation = advantage === "normal" ? "" : `, ${advantage}`;
            return `${rollsStr} (${count}d${d.sides}${annotation})`;
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
        keptRolls,
        advantage,
        variant,
        formattedText,
    };
}
