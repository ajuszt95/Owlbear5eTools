import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID } from "./Background";
import {
    render5etoolsText,
    type RenderSegment,
} from "./utils/renderer";
import {
    applyAdvantageNotation,
    critFormula,
    evaluateRoll,
    keptD20FromDicePlus,
    parseDiceFormula,
    type Advantage,
} from "./utils/diceRoller";
import { DICE_PLUS_RESULT_TIMEOUT_MS } from "./initiative";

/** A roll-capable segment (narrows RenderSegment). */
export type RollSegment = Extract<RenderSegment, { type: "roll" }>;
export type RollEngine = "dice-plus" | "basic";

/** One routine step: run <attack> <count> time(s), attack roll then damage. */
export type RoutineStep = { attack: string; count: number };

/** Inline log line for the routine panel. */
export type RoutineLogEntry = {
    label: string;
    formula?: string;
    notation?: string;
    total?: number;
    rollId?: string;
    note?: string;
    ok: boolean;
};

/** Singles safety unlock (mirrors RollButton): never block longer than this. */
const DICE_SAFETY_UNLOCK_MS = 10_000;
/** Fire-and-forget crit watch window for single clicks (mirrors RollButton). */
const SINGLE_CRIT_WATCH_MS = 30_000;

// ────────────────────────────────────────────────────────────────────────────
// Multiattack parsing (pure)
// ────────────────────────────────────────────────────────────────────────────

const COUNT_WORDS: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
};

/** Lowercase alphanumeric only — mirrors the api.ts name sanitizer. */
function sanitizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .replace(/s$/, "");
}

/**
 * Resolve a Multiattack reference ("beak", "claws", "CLAWS") to an action
 * name. Exact sanitized match first, then prefix either direction (mirrors
 * the api.ts monster-name fallback) so plurals/case resolve.
 */
export function matchAttackName(
    ref: string,
    candidates: string[]
): string | null {
    const needle = sanitizeName(ref);
    if (!needle) return null;
    const cleaned = candidates.map((c) => ({ raw: c, clean: sanitizeName(c) }));
    const exact = cleaned.find((c) => c.clean === needle);
    if (exact) return exact.raw;
    const prefix = cleaned.find(
        (c) => c.clean.startsWith(needle) || needle.startsWith(c.clean)
    );
    return prefix ? prefix.raw : null;
}

/** Flatten string/object entries to plain text for clause scanning. */
function flattenEntriesToText(entries: unknown): string {
    if (typeof entries === "string") return entries;
    if (Array.isArray(entries)) {
        return entries
            .map((e) => {
                if (typeof e === "string") return e;
                if (e && typeof e === "object") {
                    const obj = e as { entry?: unknown; entries?: unknown };
                    if (typeof obj.entry === "string") return obj.entry;
                    if (obj.entries) return flattenEntriesToText(obj.entries);
                }
                return "";
            })
            .filter(Boolean)
            .join(" ");
    }
    return "";
}

/**
 * Parse a Multiattack entries array into ordered routine steps.
 * Handles "makes two attacks: one with its beak and one with its claws" and
 * "makes three attacks: one with its bite and two with its claws". Clauses
 * that resolve to no known action (Frightful Presence lead-ins, breath
 * references) are ignored; null unless at least one step resolves.
 */
export function parseMultiattack(
    multiEntries: unknown,
    actionNames: string[]
): RoutineStep[] | null {
    const text = flattenEntriesToText(multiEntries).toLowerCase();
    if (!text) return null;
    const steps: RoutineStep[] = [];
    // Lazy-optional clause skip (??): prefer "N with its X" directly so the
    // skip-group can never eat an earlier attack ("beak and one with its...").
    // It still kicks in via backtracking for "one melee attack with its X".
    const pattern =
        /\b(one|two|three|four|five|six|\d+)\s+(?:[^:;.]*?\s+)??with\s+its\s+([a-z]+)/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
        const countWord = m[1];
        const ref = m[2].trim();
        const count = COUNT_WORDS[countWord] ?? parseInt(countWord, 10);
        if (!count || count < 1) continue;
        const attack = matchAttackName(ref, actionNames);
        if (!attack) continue;
        steps.push({ attack, count });
    }
    if (steps.length === 0) return null;
    // Stable sort by action-array position so text order and stat block order agree.
    const order = new Map(actionNames.map((n, i) => [n, i]));
    steps.sort(
        (a, b) => (order.get(a.attack) ?? 0) - (order.get(b.attack) ?? 0)
    );
    return steps;
}

/** First roll segment of a kind inside an action's entries (strings only). */
function firstSegmentOfKind(
    action: unknown,
    kind: "attack" | "damage"
): RollSegment | null {
    const entries =
        action && typeof action === "object"
            ? (action as { entries?: unknown }).entries
            : undefined;
    if (!Array.isArray(entries)) return null;
    for (const e of entries) {
        if (typeof e !== "string") continue;
        for (const s of render5etoolsText(e)) {
            if (s.type === "roll" && s.kind === kind) return s;
        }
    }
    return null;
}

/** e.g. Beak -> "1d20+7" (reuses the renderer's {@hit} handling, never reimplemented). */
export function getAttackHitFormula(action: unknown): string | null {
    return firstSegmentOfKind(action, "attack")?.formula ?? null;
}

/** e.g. Beak -> "1d10 + 5". */
export function getAttackDamageFormula(action: unknown): string | null {
    return firstSegmentOfKind(action, "damage")?.formula ?? null;
}

/** Same extractors returning the full segment (for chaining + the runner). */
export function getAttackHitSegment(action: unknown): RollSegment | null {
    return firstSegmentOfKind(action, "attack");
}

export function getAttackDamageSegment(action: unknown): RollSegment | null {
    return firstSegmentOfKind(action, "damage");
}

export type ResolvedRoutine = {
    steps: RoutineStep[];
    /** Action names mentioned but not runnable (logged as skipped lines). */
    skipped: string[];
    /** Total attack+damage sends the Run button will emit. */
    totalRolls: number;
};

/**
 * Resolve a monster's action[] into a runnable routine, or null when there
 * is no Multiattack / nothing resolves (callers render nothing then).
 */
export function resolveRoutine(actions: unknown): ResolvedRoutine | null {
    if (!Array.isArray(actions)) return null;
    const names = actions
        .map((a) =>
            a && typeof a === "object" && typeof (a as { name?: unknown }).name === "string"
                ? String((a as { name: unknown }).name)
                : ""
        )
        .filter(Boolean);
    const multi = actions.find(
        (a) =>
            a &&
            typeof a === "object" &&
            typeof (a as { name?: unknown }).name === "string" &&
            String((a as { name: unknown }).name).toLowerCase() === "multiattack"
    ) as { entries?: unknown } | undefined;
    if (!multi || !Array.isArray(multi.entries)) return null;
    const steps = parseMultiattack(multi.entries, names);
    if (!steps) return null;
    const text = flattenEntriesToText(multi.entries).toLowerCase();
    const sanitizedText = text.replace(/[^a-z0-9]/g, "");
    const stepped = new Set(steps.map((s) => s.attack));
    const skipped = names.filter(
        (n) =>
            n.toLowerCase() !== "multiattack" &&
            !stepped.has(n) &&
            sanitizedText.includes(n.toLowerCase().replace(/[^a-z0-9]/g, ""))
    );
    let totalRolls = 0;
    for (const s of steps) {
        const action = actions.find(
            (a) =>
                a && typeof a === "object" && (a as { name?: unknown }).name === s.attack
        );
        totalRolls += s.count * (getAttackDamageSegment(action) ? 2 : 1);
    }
    return { steps, skipped, totalRolls };
}

// ────────────────────────────────────────────────────────────────────────────
// Shared single-roll sender (RollButton delegates; unchanged single behavior)
// ────────────────────────────────────────────────────────────────────────────

export type SendContext = {
    rollTarget: string;
    rollEngine: RollEngine;
    advantage: Advantage;
    critArmed: boolean;
    setCritArmed: (v: boolean) => void;
    setIsRolling: (v: boolean) => void;
    /** Suppress per-roll notifications (turn follow-ups log inline instead). */
    silent?: boolean;
};

export type RollOutcome = {
    ok: boolean;
    label: string;
    kind: string;
    formula: string;
    notation: string;
    rollId?: string;
    total?: number;
    nat20?: boolean;
    critUsed?: boolean;
    error?: string;
};

/** Advantage applies to attack/check/save/dc only — mirrors RollButton. */
function advantageForKind(kind: string | undefined, advantage: Advantage): Advantage {
    return kind === "attack" ||
        kind === "check" ||
        kind === "save" ||
        kind === "dc"
        ? advantage
        : "normal";
}

function describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * The exact RollButton send path, extracted verbatim: crit-doubled damage
 * when armed, advantage notation, Basic local eval vs Dice+ broadcast with
 * the Nat20 crit watch. Returns an outcome for logging instead of void.
 */
export async function sendSingleRoll(
    segment: RollSegment,
    ctx: SendContext
): Promise<RollOutcome> {
    const isDamage = segment.kind === "damage";
    const advantage = advantageForKind(segment.kind, ctx.advantage);
    const critUsed = isDamage && ctx.critArmed;

    if (ctx.rollEngine === "basic") {
        const rollFormula = critUsed
            ? critFormula(segment.formula)
            : segment.formula;
        try {
            const result = evaluateRoll(rollFormula, {
                label: segment.label,
                advantage,
            });
            const nat20 = result.isNat20 && segment.kind === "attack";
            if (nat20) ctx.setCritArmed(true);
            if (critUsed) ctx.setCritArmed(false);
            if (!ctx.silent) {
                const critMessage = nat20
                    ? "\nCrit armed for your next damage roll."
                    : "";
                await OBR.notification.show(
                    `${result.formattedText}${critMessage}`,
                    result.variant
                );
            }
            return {
                ok: true,
                label: segment.label,
                kind: segment.kind ?? "other",
                formula: segment.formula,
                notation: rollFormula,
                total: result.total,
                nat20,
                critUsed,
            };
        } catch (err) {
            if (!ctx.silent) {
                await OBR.notification.show(
                    `Failed to roll ${segment.formula}`,
                    "ERROR"
                );
            }
            return {
                ok: false,
                label: segment.label,
                kind: segment.kind ?? "other",
                formula: segment.formula,
                notation: segment.formula,
                error: describeError(err),
            };
        }
    }

    // Dice+ mode
    ctx.setIsRolling(true);
    // Safety — auto-unlock so the next roll is never blocked.
    const safetyTimer = setTimeout(
        () => ctx.setIsRolling(false),
        DICE_SAFETY_UNLOCK_MS
    );

    try {
        const player = await OBR.player.getName();
        const playerId = await OBR.player.getId();
        const ts = Date.now();
        const rid = "roll_" + ts + "_" + Math.random().toString(36).substring(7);
        const notation = critUsed
            ? critFormula(segment.formula)
            : applyAdvantageNotation(segment.formula, advantage);

        const payload = {
            rollId: rid,
            playerId: playerId,
            playerName: player,
            rollTarget: ctx.rollTarget,
            diceNotation: notation,
            showResults: true,
            timestamp: ts,
            source: EXTENSION_ID,
        };

        // Attack rolls: watch for the Dice+ result to auto-arm crit on Nat20
        // (kept d20 decides, mirrors Basic's kept-die rule). Listen BEFORE
        // broadcast to avoid missing a fast response; fire-and-forget —
        // nothing here ever blocks on a result.
        if (segment.kind === "attack") {
            const watch = new Promise<number | null>((resolve) => {
                let settled = false;
                const cleanup = (value: number | null) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    try {
                        unsub?.();
                    } catch {
                        /* noop */
                    }
                    resolve(value);
                };
                const timer = setTimeout(
                    () => cleanup(null),
                    SINGLE_CRIT_WATCH_MS
                );
                const unsub = OBR.broadcast.onMessage(
                    `${EXTENSION_ID}/roll-result`,
                    (event: unknown) => {
                        const wrapper =
                            event as { data?: unknown } | undefined;
                        const p = (wrapper?.data ?? event) as {
                            rollId?: unknown;
                        };
                        if (p?.rollId !== rid) return;
                        cleanup(keptD20FromDicePlus(p));
                    }
                );
            });
            void watch.then(async (kept) => {
                if (kept !== 20) return;
                ctx.setCritArmed(true);
                if (!ctx.silent) {
                    await OBR.notification
                        .show(
                            "Nat 20! Crit armed for your next damage roll.",
                            "SUCCESS"
                        )
                        .catch(() => {
                            /* noop */
                        });
                }
            });
        }

        await OBR.broadcast.sendMessage(
            "dice-plus/roll-request",
            payload,
            { destination: "ALL" }
        );

        // Consume crit like Basic does — otherwise Dice+ stays armed forever.
        if (critUsed) ctx.setCritArmed(false);
        return {
            ok: true,
            label: segment.label,
            kind: segment.kind ?? "other",
            formula: segment.formula,
            notation,
            rollId: rid,
            nat20: false,
            critUsed,
        };
    } catch (err) {
        clearTimeout(safetyTimer);
        ctx.setIsRolling(false);
        return {
            ok: false,
            label: segment.label,
            kind: segment.kind ?? "other",
            formula: segment.formula,
            notation: segment.formula,
            error: describeError(err),
        };
    }
}

// ────────────────────────────────────────────────────────────────────────────
// One turn, one request: compound Dice+ notation + result group mapping.
// A whole routine is a single broadcast ("1d20+7+1d10+5+..."); Dice+ answers
// with ordered groups and our labels map back deterministically. Nothing ever
// waits on one roll to decide the next — crits resolve from the groups.
// ────────────────────────────────────────────────────────────────────────────

/** One dice term inside the compound notation. */
export type TurnPart = {
    attack: string;
    rep: number;
    kinds: "attack" | "damage";
    formula: string;
    notation: string;
};

export type BuiltTurn = {
    notation: string;
    parts: TurnPart[];
    /** Steps that lost their attack roll (logged as skipped lines). */
    skipped: string[];
};

/** Compact: Dice+ notations carry no spaces ("1d10 + 5" -> "1d10+5"). */
function compactNotation(formula: string): string {
    return formula.replace(/\s+/g, "");
}

/**
 * Build the compound turn notation from resolved steps: attack then damage
 * per sub-attack, count repeats, advantage on attacks only. Returns null
 * when nothing runnable remains.
 */
export function buildTurnNotation(
    steps: RoutineStep[],
    lookupAction: (name: string) => unknown | undefined,
    advantage: Advantage
): BuiltTurn | null {
    const parts: TurnPart[] = [];
    const skipped: string[] = [];
    for (const step of steps) {
        const action = lookupAction(step.attack);
        const hit = action ? getAttackHitSegment(action) : null;
        if (!hit) {
            skipped.push(step.attack);
            continue;
        }
        for (let i = 0; i < step.count; i++) {
            parts.push({
                attack: step.attack,
                rep: i + 1,
                kinds: "attack",
                formula: hit.formula,
                notation: compactNotation(
                    applyAdvantageNotation(hit.formula, advantage)
                ),
            });
            const damage = action ? getAttackDamageSegment(action) : null;
            if (damage) {
                parts.push({
                    attack: step.attack,
                    rep: i + 1,
                    kinds: "damage",
                    formula: damage.formula,
                    notation: compactNotation(damage.formula),
                });
            }
        }
    }
    if (parts.length === 0) return null;
    return { notation: parts.map((p) => p.notation).join("+"), parts, skipped };
}

/**
 * Crit extra dice for a damage formula: one more set of the damage dice,
 * no modifier ("2d8 + 5" -> "2d8"). Offered as a non-blocking follow-up
 * when the turn result shows a Nat20 — the physical "roll extra on crit".
 */
export function critExtraFormula(damageFormula: string): string | null {
    const cleaned = (damageFormula || "").replace(/\s+/g, "");
    if (!cleaned) return null;
    const parsed = parseDiceFormula(cleanedSafe(cleaned));
    if (parsed.dice.length === 0) return null;
    return parsed.dice.map(({ count, sides }) => `${count}d${sides}`).join("+");
}

/** Guard: only feed plausible notations to the parser (never throws). */
function cleanedSafe(cleaned: string): string {
    return /^[+-]?(?:(?:\d*)d\d+|\d+)(?:[+-](?:(?:\d*)d\d+|\d+))*$/i.test(cleaned)
        ? cleaned
        : "";
}

/** A Dice+ result group (per-docs shape; unknown-tolerant). */
export type DicePlusGroup = {
    diceType?: unknown;
    dice?: { value?: unknown; kept?: unknown; diceType?: unknown }[];
    total?: unknown;
};

/** One mapped turn line for inline display. */
export type TurnResult = {
    label: string;
    notation: string;
    total?: number;
    nat20: boolean;
    ok: boolean;
    /** Crit extra dice for a Nat20 attack ("1d10") — non-blocking follow-up. */
    extra?: string;
};

/**
 * Map Dice+ result groups back to turn parts by position (Dice+ returns
 * groups in notation order). Returns null on any shape mismatch so callers
 * fall back to raw display instead of mislabeling dice.
 */
export function mapTurnGroups(
    parts: TurnPart[],
    groups: unknown
): TurnResult[] | null {
    if (!Array.isArray(groups) || groups.length !== parts.length) return null;
    const results: TurnResult[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const g = groups[i] as DicePlusGroup;
        if (!g || typeof g !== "object" || !Array.isArray(g.dice)) return null;
        const total = typeof g.total === "number" ? g.total : undefined;
        const nat20 =
            part.kinds === "attack" && keptD20FromDicePlus([g]) === 20;
        const repSuffix =
            parts.filter((p) => p.attack === part.attack && p.kinds === part.kinds)
                .length > 1
                ? ` ${part.rep}`
                : "";
        // Crit extra rides on the attack line: its damage sibling's dice.
        let extra: string | undefined;
        if (nat20) {
            const sibling = parts.find(
                (p) =>
                    p.attack === part.attack &&
                    p.rep === part.rep &&
                    p.kinds === "damage"
            );
            extra = sibling ? critExtraFormula(sibling.formula) ?? undefined : undefined;
        }
        results.push({
            label: `${part.attack}${repSuffix} ${part.kinds}`,
            notation: part.notation,
            total,
            nat20,
            ok: total !== undefined,
            extra,
        });
    }
    return results;
}

export type TurnSendOutcome =
    | { ok: true; rollId: string; groups: DicePlusGroup[] }
    | { ok: false; rollId: string; error: string };

/**
 * Send the compound turn as ONE Dice+ request (listen-before-broadcast,
 * same 10 s timeout as initiative). Resolves on result, roll-error, or
 * timeout — never longer, never stuck.
 */
export async function sendTurnRequest(
    notation: string,
    rollTarget: string
): Promise<TurnSendOutcome> {
    const player = await OBR.player.getName();
    const playerId = await OBR.player.getId();
    const ts = Date.now();
    const rid = "turn_" + ts + "_" + Math.random().toString(36).substring(7);

    const outcome = new Promise<TurnSendOutcome>((resolve) => {
        let settled = false;
        const cleanup = (value: TurnSendOutcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                unsubResult?.();
            } catch {
                /* noop */
            }
            try {
                unsubError?.();
            } catch {
                /* noop */
            }
            resolve(value);
        };
        const timer = setTimeout(
            () => cleanup({ ok: false, rollId: rid, error: "Dice+ timed out" }),
            DICE_PLUS_RESULT_TIMEOUT_MS
        );
        const unsubResult = OBR.broadcast.onMessage(
            `${EXTENSION_ID}/roll-result`,
            (event: unknown) => {
                const wrapper = event as { data?: unknown } | undefined;
                const p = (wrapper?.data ?? event) as {
                    rollId?: unknown;
                    result?: { groups?: unknown };
                };
                if (p?.rollId !== rid) return;
                const groups = p?.result?.groups;
                if (!Array.isArray(groups)) {
                    cleanup({ ok: false, rollId: rid, error: "Dice+ sent no groups" });
                    return;
                }
                cleanup({ ok: true, rollId: rid, groups: groups as DicePlusGroup[] });
            }
        );
        const unsubError = OBR.broadcast.onMessage(
            `${EXTENSION_ID}/roll-error`,
            (event: unknown) => {
                const wrapper = event as { data?: unknown } | undefined;
                const p = (wrapper?.data ?? event) as {
                    rollId?: unknown;
                    error?: unknown;
                };
                if (p?.rollId !== rid) return;
                cleanup({
                    ok: false,
                    rollId: rid,
                    error:
                        typeof p?.error === "string" && p.error
                            ? p.error
                            : "Dice+ reported an error",
                });
            }
        );
    });

    try {
        await OBR.broadcast.sendMessage(
            "dice-plus/roll-request",
            {
                rollId: rid,
                playerId: playerId,
                playerName: player,
                rollTarget: rollTarget,
                diceNotation: notation,
                showResults: true,
                timestamp: ts,
                source: EXTENSION_ID,
            },
            { destination: "ALL" }
        );
    } catch (err) {
        return { ok: false, rollId: rid, error: describeError(err) };
    }
    return outcome;
}
