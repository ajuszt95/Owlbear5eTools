import OBR from "@owlbear-rodeo/sdk";
import { INITIATIVE_METADATA_KEY } from "./Background";
import { evaluateRoll, type RollResult } from "./utils/diceRoller";

/**
 * Standard D&D ability modifier: floor((score - 10) / 2).
 * Missing / non-numeric DEX defaults to +0 (as if DEX 10).
 */
export function dexModifier(dex?: number): number {
    if (typeof dex !== "number" || isNaN(dex)) return 0;
    return Math.floor((dex - 10) / 2);
}

/**
 * Strips Dice+ `#label` forbidden characters: + - * / , ( ) #
 * Keeps spaces (collapsed) so "Initiative - Goblin" style labels stay readable.
 */
export function sanitizeDicePlusLabel(name: string): string {
    if (!name) return "";
    return name
        .replace(/[+\-*/(),#]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Builds Dice+ notation with a ` # ` suffix label, e.g. "1d20+2 # Initiative Goblin".
 * Omits "+0" (plain "1d20"), uses "-X" for negatives.
 * `monsterName` is sanitized; empty names fall back to a bare "# Initiative" label.
 *
 * NOTE: Dice+ requires spaces around `#` ("3d6 # Fire damage") and ends the
 * label at any math operator (+ - * /), so the label itself must contain no
 * operators — hence "Initiative <name>" with a space, not "Initiative - <name>".
 * A hyphenated label like "1d20#Initiative - Goblin" is rejected by Dice+
 * with "Invalid dice notation" (verified live 2026-09-03).
 *
 * NOTE: always emit an explicit modifier, even +0. Dice+ fails to split the
 * label off a bare "1d20 # Label" (no operator before `#`) and echoes the raw
 * notation in the result display; "1d20+0 # Label" renders cleanly like the
 * +X cases (verified live 2026-09-03).
 */
export function initiativeNotation(mod: number, monsterName: string): string {
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const base = `1d20${modStr}`;
    const clean = sanitizeDicePlusLabel(monsterName || "");
    if (!clean) return `${base} # Initiative`;
    return `${base} # Initiative ${clean}`;
}

/** Minimal monster shape needed for initiative (avoids importing full Monster type). */
export interface InitiativeMonster {
    dex?: number;
    name?: string;
    _displayName?: string;
}

/**
 * DEX tiebreak: appends the DEX modifier as a decimal fraction so tokens with
 * identical d20+mod totals still sort deterministically in the tracker
 * (which sorts `count` via parseFloat). E.g. roll total 19 with mod +4 → 19.4;
 * mod +0 → unchanged integer. Rounded to one decimal to avoid float artifacts.
 */
export function initiativeTiebreakTotal(total: number, mod: number): number {
    if (mod === 0) return total;
    return Math.round((total + mod / 10) * 10) / 10;
}

/**
 * Local (Basic engine) initiative roll: 1d20 + DEX mod, labeled
 * `Initiative — <name>` (em dash). The optional roller enables deterministic tests.
 */
export function rollInitiativeBasic(
    monster: InitiativeMonster,
    label?: string,
    roller?: (sides: number) => number
): RollResult {
    const mod = dexModifier(monster.dex);
    const modStr = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : "";
    const formula = `1d20${modStr}`;
    const displayName = monster._displayName || monster.name || "creature";
    const rollLabel = label ?? `Initiative \u2014 ${displayName}`;
    return evaluateRoll(formula, { label: rollLabel, roller });
}

export interface WriteInitiativeResult {
    written: boolean;
    previous?: string;
}

/**
 * Writes `{ count: "<total>", active: false }` to the official Initiative Tracker
 * metadata key. Never overwrites an existing count unless `overwrite: true`.
 * Sibling metadata keys are left untouched. Returns the previous count (if any)
 * so the caller owns the `window.confirm()` decision.
 */
export async function writeInitiative(
    tokenId: string,
    total: number,
    opts: { overwrite: boolean }
): Promise<WriteInitiativeResult> {
    const items = await OBR.scene.items.getItems([tokenId]);
    if (items.length === 0) {
        throw new Error("Token not found.");
    }

    const existing = items[0].metadata?.[INITIATIVE_METADATA_KEY] as
        | { count?: unknown }
        | undefined;
    const rawCount = existing?.count;
    const previous =
        rawCount !== undefined && rawCount !== null && String(rawCount) !== ""
            ? String(rawCount)
            : undefined;

    if (previous !== undefined && !opts.overwrite) {
        return { written: false, previous };
    }

    const countStr = String(total);
    await OBR.scene.items.updateItems([tokenId], (draft) => {
        const item = draft[0];
        if (!item) return;
        item.metadata[INITIATIVE_METADATA_KEY] = { count: countStr, active: false };
    });

    return { written: true, previous };
}
