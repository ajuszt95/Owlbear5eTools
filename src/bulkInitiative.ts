import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, INITIATIVE_METADATA_KEY, METADATA_KEY } from "./Background";
import type { Monster } from "./api";
import {
    dexModifier,
    initiativeNotation,
    initiativeTiebreakTotal,
    rollInitiativeBasic,
    writeInitiative,
} from "./initiative";
import type { Advantage } from "./utils/diceRoller";

/** A scene token carrying our monster metadata (player tokens never have it). */
export interface BulkToken {
    id: string;
    name: string;
    monster: Monster;
}

/**
 * Pure filter: every scene item whose metadata carries a monster stat block.
 * Display name prefers the (possibly scaled) monster name, then the item name.
 */
export function collectMonsterTokens(items: Item[]): BulkToken[] {
    const out: BulkToken[] = [];
    for (const item of items) {
        const monster = item.metadata?.[METADATA_KEY] as Monster | undefined;
        if (!monster || typeof monster !== "object") continue;
        out.push({
            id: item.id,
            name: monster._displayName || monster.name || item.name,
            monster,
        });
    }
    return out;
}

/**
 * Pure participation gate: checked candidates only, candidate order preserved.
 * Unchecked tokens are excluded from the run entirely (no read, no write,
 * no pending announcement).
 */
export function eligibleForRun(candidates: BulkToken[], checkedIds: Set<string>): BulkToken[] {
    return candidates.filter((c) => checkedIds.has(c.id));
}

/** Presence check only (any shape) — lair fetching itself is issue #8's job. */
export function hasLair(token: BulkToken): boolean {
    const lg = (token.monster as { legendaryGroup?: unknown }).legendaryGroup;
    return lg !== undefined && lg !== null;
}

export interface BulkRollContext {
    engine: "dice-plus" | "basic";
    rollTarget: string;
    advantage: Advantage;
    /** Test seam: Dice+ result wait (default 10_000, mirrors ViewPopover). */
    dicePlusTimeoutMs?: number;
    /** Test seam: gap between sequential Dice+ rolls (default 300). */
    interRollGapMs?: number;
}

/**
 * Reads current tracker counts for the given ids in one getItems call.
 * Returns id -> count string; missing/empty counts map to undefined (free).
 */
export async function readExistingCounts(ids: string[]): Promise<Map<string, string | undefined>> {
    const items = await OBR.scene.items.getItems(ids);
    const map = new Map<string, string | undefined>();
    for (const id of ids) {
        map.set(id, undefined);
    }
    for (const item of items) {
        const raw = (item.metadata?.[INITIATIVE_METADATA_KEY] as { count?: unknown } | undefined)?.count;
        if (raw !== undefined && raw !== null && String(raw) !== "") {
            map.set(item.id, String(raw));
        }
    }
    return map;
}

/** Best-effort stand-down for the background initiative safety net. */
async function settleRoll(rid: string): Promise<void> {
    if (!rid) return;
    try {
        await OBR.broadcast.sendMessage(
            `${EXTENSION_ID}/initiative-settled`,
            { rollId: rid },
            { destination: "ALL" }
        );
    } catch { /* safety net is best-effort */ }
}

export interface SingleRollOutcome {
    total: number;
    /** True for Basic rolls and Dice+ local fallbacks. */
    local: boolean;
    /** The announced Dice+ roll id ("" for Basic) — caller settles after writing. */
    rid: string;
}

/**
 * One token's roll, mirroring ViewPopover.handleRollInitiative's Dice+ sequence
 * verbatim (pending announce -> listen-before-broadcast -> 10s local fallback).
 * On success the roll stays pending until the caller writes + settles; on any
 * throw after the announce, this settles first so no orphan pending entry
 * survives (the background safety net stands down).
 */
export async function rollOneToken(token: BulkToken, ctx: BulkRollContext): Promise<SingleRollOutcome> {
    const mod = dexModifier(token.monster.dex);
    const monsterName = token.monster._displayName || token.monster.name || token.name;

    if (ctx.engine === "basic") {
        const result = rollInitiativeBasic(token.monster, undefined, undefined, ctx.advantage);
        return { total: initiativeTiebreakTotal(result.total, mod), local: true, rid: "" };
    }

    const timeoutMs = ctx.dicePlusTimeoutMs ?? 10_000;
    let rid = "";
    try {
        const notation = initiativeNotation(mod, monsterName, ctx.advantage);
        const player = await OBR.player.getName();
        const playerId = await OBR.player.getId();
        const ts = Date.now();
        rid = "init_" + ts + "_" + Math.random().toString(36).substring(7);

        try {
            await OBR.broadcast.sendMessage(
                `${EXTENSION_ID}/initiative-pending`,
                { rollId: rid, tokenId: token.id, mod },
                { destination: "ALL" }
            );
        } catch { /* safety net is best-effort */ }

        // Listen BEFORE broadcast to avoid missing a fast response.
        const totalPromise = new Promise<number | null>((resolve) => {
            const state = { settled: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
            const unsub = OBR.broadcast.onMessage(`${EXTENSION_ID}/roll-result`, (event: unknown) => {
                const wrapper = event as { data?: unknown } | undefined;
                const payload = (wrapper?.data ?? event) as {
                    rollId?: unknown;
                    result?: { totalValue?: unknown };
                    totalValue?: unknown;
                    total?: unknown;
                } | undefined;
                if (payload?.rollId === rid) {
                    const totalVal = payload?.result?.totalValue ?? payload?.totalValue ?? payload?.total;
                    if (typeof totalVal === "number") {
                        if (state.settled) return;
                        state.settled = true;
                        if (state.timer) clearTimeout(state.timer);
                        try { unsub(); } catch { /* noop */ }
                        resolve(totalVal);
                    }
                }
            });
            state.timer = setTimeout(() => {
                if (state.settled) return;
                state.settled = true;
                try { unsub(); } catch { /* noop */ }
                resolve(null);
            }, timeoutMs);
        });

        await OBR.broadcast.sendMessage(
            "dice-plus/roll-request",
            {
                rollId: rid,
                playerId: playerId,
                playerName: player,
                rollTarget: ctx.rollTarget,
                diceNotation: notation,
                showResults: true,
                timestamp: ts,
                source: EXTENSION_ID,
            },
            { destination: "ALL" }
        );

        const dicePlusTotal = await totalPromise;
        if (dicePlusTotal !== null) {
            return { total: initiativeTiebreakTotal(dicePlusTotal, mod), local: false, rid };
        }
        const fallbackResult = rollInitiativeBasic(token.monster, undefined, undefined, ctx.advantage);
        return { total: initiativeTiebreakTotal(fallbackResult.total, mod), local: true, rid };
    } catch (err) {
        await settleRoll(rid);
        throw err;
    }
}

export type BulkRowStatus = "written" | "skipped" | "failed";

export interface BulkRow {
    id: string;
    name: string;
    status: BulkRowStatus;
    total?: number;
    /** Previous tracker count (skip rows and overwritten rows). */
    previous?: string;
    local?: boolean;
    // TODO(lair-20): auto-enter lair action at 20 for marked tokens.
    lair?: boolean;
    error?: string;
}

/**
 * Sequential bulk runner (never parallel Dice+ broadcasts — result/rollId
 * matching breaks). Skip-mode collects skips via the write guard with zero
 * dialogs; overwrite mode assumes the caller already took the single upfront
 * confirm. Every resolved token is settled (written, skipped, or failed).
 */
export async function runBulkInitiative(opts: {
    tokens: BulkToken[];
    overwrite: boolean;
    existing: Map<string, string | undefined>;
    ctx: BulkRollContext;
    onProgress?: (done: number, total: number) => void;
}): Promise<BulkRow[]> {
    const rows: BulkRow[] = [];
    const gapMs = opts.ctx.interRollGapMs ?? 300;
    for (const token of opts.tokens) {
        const previous = opts.existing.get(token.id);
        const lair = hasLair(token) || undefined;
        if (previous !== undefined && !opts.overwrite) {
            rows.push({ id: token.id, name: token.name, status: "skipped", previous, lair });
            opts.onProgress?.(rows.length, opts.tokens.length);
            continue;
        }
        try {
            const outcome = await rollOneToken(token, opts.ctx);
            try {
                const written = await writeInitiative(token.id, outcome.total, { overwrite: opts.overwrite });
                rows.push({
                    id: token.id,
                    name: token.name,
                    status: "written",
                    total: outcome.total,
                    previous: written.previous,
                    local: outcome.local || undefined,
                    lair,
                });
            } finally {
                await settleRoll(outcome.rid);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            rows.push({ id: token.id, name: token.name, status: "failed", error: msg, lair });
        }
        if (opts.ctx.engine === "dice-plus" && gapMs > 0) {
            await new Promise((r) => setTimeout(r, gapMs));
        }
        opts.onProgress?.(rows.length, opts.tokens.length);
    }
    return rows;
}
