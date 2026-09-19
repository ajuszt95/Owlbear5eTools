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
    type Advantage,
} from "./utils/diceRoller";

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

/** Gap between Dice+ sends so popups never overlap (bulk initiative uses 300). */
export const ROUTINE_STEP_GAP_MS = 250;
/** How long a routine attack waits for its Dice+ result before rolling damage anyway. */
export const ROUTINE_ATTACK_RESULT_TIMEOUT_MS = 30_000;
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
// Shared single-roll sender (singles delegate; the routine runner loops it)
// ────────────────────────────────────────────────────────────────────────────

export type SendContext = {
    rollTarget: string;
    rollEngine: RollEngine;
    advantage: Advantage;
    critArmed: boolean;
    setCritArmed: (v: boolean) => void;
    setIsRolling: (v: boolean) => void;
    /** Routine steps: suppress per-step notifications (one summary toast instead). */
    silent?: boolean;
    /** Routine attack steps: await the Dice+ result so Nat20 crits chain into damage. */
    awaitDiceResult?: boolean;
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
        // broadcast to avoid missing a fast response; singles watch
        // fire-and-forget while routine attacks await so damage crits correctly.
        let attackWatch: Promise<number | null> | null = null;
        if (segment.kind === "attack") {
            attackWatch = new Promise<number | null>((resolve) => {
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
                    ctx.awaitDiceResult
                        ? ROUTINE_ATTACK_RESULT_TIMEOUT_MS
                        : SINGLE_CRIT_WATCH_MS
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
        }

        await OBR.broadcast.sendMessage(
            "dice-plus/roll-request",
            payload,
            { destination: "ALL" }
        );

        let nat20 = false;
        if (attackWatch) {
            const armOnNat20 = async (kept: number | null) => {
                if (kept !== 20) return;
                nat20 = true;
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
            };
            if (ctx.awaitDiceResult) {
                await armOnNat20(await attackWatch);
            } else {
                void attackWatch.then(armOnNat20);
            }
        }

        // Consume crit like Basic does — otherwise Dice+ stays armed forever.
        if (critUsed) ctx.setCritArmed(false);
        return {
            ok: true,
            label: segment.label,
            kind: segment.kind ?? "other",
            formula: segment.formula,
            notation,
            rollId: rid,
            nat20,
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
// Routine runner (pure orchestration; ViewPopover injects OBR-backed deps)
// ────────────────────────────────────────────────────────────────────────────

export type RoutineRunnerDeps = {
    lookupAction: (name: string) => unknown | undefined;
    send: (
        segment: RollSegment,
        opts: { awaitDiceResult?: boolean }
    ) => Promise<RollOutcome>;
    log: (entry: RoutineLogEntry) => void;
    sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

function outcomeNote(outcome: RollOutcome): string | undefined {
    if (!outcome.ok) return outcome.error ?? "failed";
    if (outcome.kind === "attack" && outcome.nat20) return "Nat 20 — crit armed";
    if (outcome.critUsed) return "crit";
    return undefined;
}

/**
 * Execute steps in order (attack then damage per sub-attack, count repeats).
 * Individual failures are logged and never abort the run. Sequential —
 * never parallelized, so Dice+ popups can't overlap.
 */
export async function executeRoutine(
    steps: RoutineStep[],
    skipped: string[],
    deps: RoutineRunnerDeps
): Promise<{ sent: number; failed: number }> {
    const sleep = deps.sleep ?? defaultSleep;
    let sent = 0;
    let failed = 0;
    let firstSend = true;

    for (const name of skipped) {
        deps.log({
            label: name,
            note: "skipped — non-attack entry",
            ok: true,
        });
    }

    for (const step of steps) {
        for (let i = 0; i < step.count; i++) {
            const action = deps.lookupAction(step.attack);
            const hit = action ? getAttackHitSegment(action) : null;
            if (!hit) {
                deps.log({
                    label: step.attack,
                    note: "skipped — no attack roll",
                    ok: false,
                });
                failed += 1;
                continue;
            }
            const countSuffix = step.count > 1 ? ` (${i + 1}/${step.count})` : "";

            if (!firstSend) await sleep(ROUTINE_STEP_GAP_MS);
            firstSend = false;
            let attackOutcome: RollOutcome;
            try {
                attackOutcome = await deps.send(hit, { awaitDiceResult: true });
            } catch (err) {
                attackOutcome = {
                    ok: false,
                    label: hit.label,
                    kind: "attack",
                    formula: hit.formula,
                    notation: hit.formula,
                    error: describeError(err),
                };
            }
            sent += 1;
            if (!attackOutcome.ok) failed += 1;
            deps.log({
                label: `${step.attack} attack${countSuffix}`,
                formula: attackOutcome.formula,
                notation: attackOutcome.notation,
                total: attackOutcome.total,
                rollId: attackOutcome.rollId,
                note: outcomeNote(attackOutcome),
                ok: attackOutcome.ok,
            });

            const damage = action ? getAttackDamageSegment(action) : null;
            if (!damage) continue;
            await sleep(ROUTINE_STEP_GAP_MS);
            let damageOutcome: RollOutcome;
            try {
                damageOutcome = await deps.send(damage, {});
            } catch (err) {
                damageOutcome = {
                    ok: false,
                    label: damage.label,
                    kind: "damage",
                    formula: damage.formula,
                    notation: damage.formula,
                    error: describeError(err),
                };
            }
            sent += 1;
            if (!damageOutcome.ok) failed += 1;
            deps.log({
                label: `${step.attack} damage${countSuffix}`,
                formula: damageOutcome.formula,
                notation: damageOutcome.notation,
                total: damageOutcome.total,
                rollId: damageOutcome.rollId,
                note: outcomeNote(damageOutcome),
                ok: damageOutcome.ok,
            });
        }
    }
    return { sent, failed };
}
