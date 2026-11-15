import OBR from "@owlbear-rodeo/sdk";
import type { Advantage, RollResult } from "./diceRoller";
import { render5etoolsPlainText } from "./renderer";
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

export interface DicePlusResult {
    totalValue?: number;
    groups?: Array<{
        diceType?: string;
        dice?: Array<{ value?: number; kept?: boolean; diceType?: string }>;
    }>;
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

/**
 * Card label for a roll. Prefers the owning action name (e.g. "Scimitar",
 * "Fire Bolt"), stripped of 5e.tools markup since spell names arrive as
 * `{@spell fire bolt|PHB}`; falls back to the button's own label, then "Roll".
 */
export function resolveActionLabel(
    action: string | undefined,
    fallback?: string,
): string {
    const named = render5etoolsPlainText(action ?? "").trim();
    if (named) return named;
    const label = (fallback ?? "").trim();
    return label || "Roll";
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

export function buildRollFromDicePlusResult(
    result: DicePlusResult,
    intent: GameLogIntent,
): GameLogRoll | null {
    const modifier = flatModifier(intent.formula);
    const keepMatch = intent.formula.match(/(\d*)d20(kh|kl)(\d+)/i);
    const keep: GameLogDiceTerm["keep"] = keepMatch
        ? {
            mode: keepMatch[2].toLowerCase() === "kh" ? "highest" : "lowest",
            count: Number(keepMatch[3]),
        }
        : undefined;

    const groups = result.groups ?? [];
    const usableGroups: GameLogDiceTerm[] = [];

    for (const group of groups) {
        const diceType = group.diceType ?? group.dice?.[0]?.diceType;
        const faces = Number(diceType?.replace("d", ""));
        if (!Number.isFinite(faces) || faces <= 0) continue;

        const values = (group.dice ?? []).map((die) => Number(die.value));
        if (values.some((value) => !Number.isFinite(value))) continue;

        const results = (group.dice ?? []).map((die) => ({
            value: Number(die.value),
            active: die.kept !== false,
        }));

        usableGroups.push({
            faces,
            count: values.length,
            results,
            keep: faces === 20 ? keep : undefined,
        });
    }

    if (usableGroups.length === 0) return null;

    const totalValue = result.totalValue;
    const total =
        typeof totalValue === "number" && Number.isFinite(totalValue)
            ? totalValue
            : usableGroups.reduce((sum, group) => sum + group.results.filter((die) => die.active).reduce((sum, die) => sum + die.value, 0), 0) + modifier;

    const d20 = usableGroups.find((group) => group.faces === 20);
    const natural = d20?.results.find((die) => die.active)?.value;
    const outcome =
        natural === 20 ? "critical" : natural === 1 ? "fumble" : null;

    return {
        type: rollTypeForSegment(intent.segmentKind),
        kind: rollKindFor(intent.advantage, intent.segmentKind, intent.critArmed),
        formula: intent.formula,
        total,
        constant: modifier,
        dice: usableGroups,
        outcome,
    };
}

function flatModifier(formula: string): number {
    const stripped = (formula || '').replace(/\s+/g, '').replace(/\d*d\d+/gi, '').replace(/k[hl]\d+/gi, '');
    const terms = stripped.match(/[+-]\d+/g) ?? [];
    return terms.reduce((sum, term) => sum + Number(term), 0);
}

export const GAMELOG_CHANNEL = "com.ddbgamelog/api/roll";
export const GAMELOG_VIA = "5e Tools";
export const GAMELOG_MAX_BYTES = 15000;

export interface GameLogPayload {
    v: 1;
    rollId: string;
    via: string;
    hidden?: boolean;
    entity: GameLogEntity;
    action: string;
    rolls: GameLogRoll[];
}

export function buildGameLogPayload(args: {
    rollId: string;
    entity: GameLogEntity;
    intent: GameLogIntent;
    rolls: GameLogRoll[];
}): GameLogPayload | null {
    if (args.rolls.length === 0) return null;

    const payload: GameLogPayload = {
        v: 1,
        rollId: args.rollId,
        via: GAMELOG_VIA,
        entity: {
            id: args.entity.id,
            type: args.entity.type,
            name: args.entity.name.slice(0, 128),
        },
        action: (args.intent.action || "Roll").slice(0, 256),
        rolls: args.rolls.slice(0, 10),
    };

    if (args.entity.avatarUrl?.startsWith("https://")) {
        payload.entity.avatarUrl = args.entity.avatarUrl;
    }

    if (args.intent.hidden) {
        payload.hidden = true;
    }

    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (bytes > GAMELOG_MAX_BYTES) return null;

    return payload;
}

export function isExpiredPending(
    entry: { at: number },
    now: number,
    ttlMs = 30_000,
): boolean {
    return now - entry.at > ttlMs;
}

export async function sendGameLogRoll(payload: GameLogPayload): Promise<boolean> {
    try {
        await OBR.broadcast.sendMessage(GAMELOG_CHANNEL, payload, {
            destination: "LOCAL",
        });
        return true;
    } catch {
        return false;
    }
}
