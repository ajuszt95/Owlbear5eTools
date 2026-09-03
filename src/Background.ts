import OBR from "@owlbear-rodeo/sdk";
import { initiativeTiebreakTotal } from "./initiative";

export const EXTENSION_ID = "com.ajuszt95.5etools";
export const METADATA_KEY = `${EXTENSION_ID}/monster`;
export const BUBBLES_METADATA_KEY = "com.owlbear-rodeo-bubbles-extension/metadata";

// Stat Bubbles Metadata IDs
export const BUBBLES_HEALTH = "health";
export const BUBBLES_MAX_HEALTH = "max health";
export const BUBBLES_TEMP_HEALTH = "temporary health";
export const BUBBLES_ARMOR_CLASS = "armor class";
export const BUBBLES_HIDE = "hide";
export const BUBBLES_NAME = "com.owlbear-rodeo-bubbles-extension/name";

// Official Owlbear Initiative Tracker metadata key.
// Upstream: owlbear-rodeo/initiative-tracker src/getPluginId.ts → getPluginId("metadata").
// Shape: { count: string; active: boolean } — count is a STRING sorted via parseFloat.
export const INITIATIVE_METADATA_KEY = "rodeo.owlbear.initiative-tracker/metadata";

// Set on first init; main.tsx calls initBackground() from the render body,
// so StrictMode (dev double-render) and HMR would otherwise register every
// broadcast listener twice. See initBackground().
let backgroundInitialized = false;

// Only Dice+ rollIds with this prefix are initiative rolls. Ordinary stat-block
// rolls share the `${EXTENSION_ID}/roll-result` channel and must be ignored here.
const INITIATIVE_ROLL_PREFIX = "init_";

// How long the safety net waits after a Dice+ result before completing the
// roll — gives an open popover time to handle (and settle) it first.
const SAFETY_NET_GRACE_MS = 4_000;
const PENDING_TTL_MS = 120_000;
const BUFFER_TTL_MS = 60_000;

type LooseRecord = Record<string, unknown>;

interface SafetyNetPending {
    tokenId: string;
    mod: number;
    announcedAt: number;
}

/**
 * Initiative safety net for orphaned Dice+ rolls (GM only; call after the role check).
 *
 * The ViewPopover announces every Dice+ initiative roll on
 * `${EXTENSION_ID}/initiative-pending` BEFORE broadcasting the dice-plus
 * request. Dice+ results always come back on `${EXTENSION_ID}/roll-result`
 * (addressed by `source: EXTENSION_ID`), which this persistent background
 * listener also receives.
 *
 * Why this exists: awaiting the Dice+ result inside the popover is fragile —
 * closing the popover destroys its JS context, the pending promise (and its
 * 10 s fallback timer) dies with it, and the roll never reaches the tracker
 * even though the Dice+ popup still shows it. When that happens this safety
 * net completes the roll: it writes the result (with DEX tiebreak) if the
 * token has no initiative yet, and NOTIFIES — never silently overwrites — if
 * one already exists.
 *
 * When the popover stays open it handles its own roll and reports back via
 * `initiative-settled` (wrote it, or the user cancelled) or
 * `initiative-awaiting-confirm` (user is deciding on the overwrite prompt),
 * so the net stands down. If the user closes the popover while the confirm
 * is open, no write happens — the confirm was never answered.
 */
export function initInitiativeSafetyNet() {
    const pending = new Map<string, SafetyNetPending>();
    const buffered = new Map<string, { total: number; receivedAt: number }>();
    const stoodDown = new Set<string>();

    const readPayload = (event: unknown): LooseRecord => {
        const wrapper = event as { data?: unknown } | undefined;
        return ((wrapper?.data ?? event) as LooseRecord) ?? {};
    };

    const sweep = () => {
        const now = Date.now();
        for (const [id, p] of pending) {
            if (now - p.announcedAt > PENDING_TTL_MS) pending.delete(id);
        }
        for (const [id, b] of buffered) {
            if (now - b.receivedAt > BUFFER_TTL_MS) buffered.delete(id);
        }
    };

    const complete = async (rollId: string) => {
        if (stoodDown.has(rollId)) return;
        const p = pending.get(rollId);
        const b = buffered.get(rollId);
        pending.delete(rollId);
        buffered.delete(rollId);
        if (!p || !b) return;

        const finalTotal = initiativeTiebreakTotal(b.total, p.mod);
        try {
            const items = await OBR.scene.items.getItems([p.tokenId]);
            if (items.length === 0) return;
            const existing = items[0].metadata?.[INITIATIVE_METADATA_KEY] as { count?: unknown } | undefined;
            const raw = existing?.count;
            const previous = raw !== undefined && raw !== null && String(raw) !== "" ? String(raw) : undefined;
            if (previous === String(finalTotal)) return; // popover already wrote it
            if (previous !== undefined) {
                await OBR.notification.show(
                    `Token already has initiative ${previous}. Reopen the stat block to overwrite with ${finalTotal}.`,
                    "DEFAULT"
                );
                return;
            }
            await OBR.scene.items.updateItems([p.tokenId], (draft) => {
                const target = draft[0];
                if (!target) return;
                target.metadata[INITIATIVE_METADATA_KEY] = { count: String(finalTotal), active: false };
            });
            const name = items[0].name ? ` for ${items[0].name}` : "";
            await OBR.notification.show(`Initiative ${finalTotal} saved to tracker${name} (stat block was closed).`, "DEFAULT");
        } catch {
            // Best effort — the Dice+ popup already showed the roll itself.
        }
    };

    const maybeSchedule = (rollId: string) => {
        if (stoodDown.has(rollId)) return;
        if (!pending.has(rollId) || !buffered.has(rollId)) return;
        setTimeout(() => {
            void complete(rollId);
        }, SAFETY_NET_GRACE_MS);
    };

    OBR.broadcast.onMessage(`${EXTENSION_ID}/initiative-pending`, (event: unknown) => {
        sweep();
        const payload = readPayload(event);
        if (typeof payload.rollId !== "string" || !payload.rollId.startsWith(INITIATIVE_ROLL_PREFIX)) return;
        if (typeof payload.tokenId !== "string") return;
        pending.set(payload.rollId, {
            tokenId: payload.tokenId,
            mod: typeof payload.mod === "number" ? payload.mod : 0,
            announcedAt: Date.now(),
        });
        maybeSchedule(payload.rollId);
    });

    OBR.broadcast.onMessage(`${EXTENSION_ID}/initiative-settled`, (event: unknown) => {
        const payload = readPayload(event);
        if (typeof payload.rollId !== "string") return;
        if (stoodDown.size > 500) stoodDown.clear();
        stoodDown.add(payload.rollId);
        pending.delete(payload.rollId);
        buffered.delete(payload.rollId);
    });

    OBR.broadcast.onMessage(`${EXTENSION_ID}/initiative-awaiting-confirm`, (event: unknown) => {
        const payload = readPayload(event);
        if (typeof payload.rollId !== "string") return;
        if (stoodDown.size > 500) stoodDown.clear();
        stoodDown.add(payload.rollId);
    });

    OBR.broadcast.onMessage(`${EXTENSION_ID}/roll-result`, (event: unknown) => {
        sweep();
        const payload = readPayload(event);
        if (typeof payload.rollId !== "string" || !payload.rollId.startsWith(INITIATIVE_ROLL_PREFIX)) return;
        if (stoodDown.has(payload.rollId)) return;
        const res = payload.result as LooseRecord | undefined;
        const total = res?.totalValue ?? payload.totalValue ?? payload.total;
        if (typeof total !== "number") return;
        buffered.set(payload.rollId, { total, receivedAt: Date.now() });
        maybeSchedule(payload.rollId);
    });

    OBR.broadcast.onMessage(`${EXTENSION_ID}/roll-error`, (event: unknown) => {
        const payload = readPayload(event);
        if (typeof payload.rollId !== "string") return;
        pending.delete(payload.rollId);
        buffered.delete(payload.rollId);
    });
}

export function initBackground() {
    // main.tsx calls this from the render body under <StrictMode>, which
    // double-invokes it in dev — and HMR can re-run it too. Without this guard
    // every broadcast listener (context menu is idempotent, the initiative
    // safety net is NOT) registers twice, causing e.g. duplicate toasts.
    if (backgroundInitialized) {
        console.log("Background already initialized, skipping duplicate init.");
        return;
    }
    backgroundInitialized = true;

    console.log("Initializing background script...");
    OBR.onReady(async () => {
        const role = await OBR.player.getRole();
        console.log("Current player role:", role);

        if (role !== "GM") {
            console.log("Not a GM. Skipping menu registration.");
            return;
        }

        console.log("OBR Ready, registering context menu...");
        OBR.contextMenu.create({
            id: `${EXTENSION_ID}/context-menu`,
            icons: [
                {
                    icon: `${import.meta.env.BASE_URL}icon.svg`,
                    label: "5e Tools",
                    filter: {
                        every: [
                            { key: "layer", operator: "==", value: "CHARACTER" },
                            { key: "type", operator: "==", value: "IMAGE" },
                        ],
                    },
                },
            ],
            onClick(context) {
                const tokenId = context.items[0].id;
                const hasMonster = context.items[0].metadata[METADATA_KEY];

                OBR.popover.open({
                    id: hasMonster ? `${EXTENSION_ID}/view-popover` : `${EXTENSION_ID}/import-popover`,
                    url: hasMonster
                        ? `${import.meta.env.BASE_URL}#/view?id=${tokenId}`
                        : `${import.meta.env.BASE_URL}#/import?id=${tokenId}`,
                    height: hasMonster ? 600 : 300,
                    width: 350,
                });
            },
        });

        // Completes orphaned Dice+ initiative rolls when the popover closes mid-roll.
        initInitiativeSafetyNet();
    });
}
