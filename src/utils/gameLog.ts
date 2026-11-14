import type { Advantage, RollResult } from "./diceRoller";
import type { RollKind } from "./renderer";

export type GameLogRollType =
    | "check"
    | "save"
    | "attack"
    | "damage"
    | "heal"
    | "initiative"
    | "recharge"
    | "custom"
    | "other";

export type GameLogRollKind = "normal" | "advantage" | "disadvantage" | "critical";

export interface GameLogDiceTerm {
    faces: number;
    count: number;
    results: { value: number; active: boolean }[];
    keep?: { mode: "highest" | "lowest"; count: number };
}

export interface GameLogRoll {
    type: GameLogRollType;
    kind: GameLogRollKind;
    formula: string;
    total: number;
    constant: number;
    dice: GameLogDiceTerm[];
    outcome: "critical" | "fumble" | null;
}

export interface GameLogEntity {
    id: string;
    type: "monster";
    name: string;
    avatarUrl?: string;
}

export interface GameLogIntent {
    action: string;
    segmentKind?: RollKind;
    advantage: Advantage;
    critArmed: boolean;
    formula: string;
    hidden: boolean;
}

const TYPE_BY_SEGMENT: Record<string, GameLogRollType> = {
    attack: "attack",
    damage: "damage",
    check: "check",
    save: "save",
    dc: "check",
    recharge: "recharge",
    other: "other",
};

export function rollTypeForSegment(kind?: RollKind): GameLogRollType {
    return (kind && TYPE_BY_SEGMENT[kind]) || "other";
}

export function rollKindFor(
    advantage: Advantage,
    segmentKind?: RollKind,
    critArmed = false,
): GameLogRollKind {
    if (critArmed && segmentKind === "damage") return "critical";
    if (advantage === "adv") return "advantage";
    if (advantage === "dis") return "disadvantage";
    return "normal";
}

export function buildRollFromBasicResult(
    result: RollResult,
    intent: GameLogIntent,
): GameLogRoll {
    const kind = rollKindFor(intent.advantage, intent.segmentKind, intent.critArmed);
    const type = rollTypeForSegment(intent.segmentKind);

    const dice: GameLogDiceTerm[] = result.diceRolls.map((group) => {
        const isAdvantageGroup =
            result.advantage !== "normal" && group.sides === 20;
        const keep: GameLogDiceTerm["keep"] =
            isAdvantageGroup
                ? { mode: result.advantage === "adv" ? "highest" : "lowest", count: 1 }
                : undefined;

        const results = group.rolls.map((value, index) => ({
            value,
            active: !isAdvantageGroup || index === 0,
        }));

        if (isAdvantageGroup) {
            const kept = result.keptRolls[0];
            const keptIndex = results.findIndex((entry) => entry.value === kept);
            results.forEach((entry, index) => {
                entry.active = index === keptIndex;
            });
        }

        return {
            faces: group.sides,
            count: group.rolls.length,
            results,
            keep,
        };
    });

    return {
        type,
        kind,
        formula: intent.formula,
        total: result.total,
        constant: result.modifier,
        dice,
        outcome: result.isNat20 ? "critical" : result.isNat1 ? "fumble" : null,
    };
}
