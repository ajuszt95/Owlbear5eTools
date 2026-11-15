import { describe, expect, it, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";
import {
    buildGameLogPayload,
    buildRollFromBasicResult,
    buildRollFromDicePlusResult,
    isExpiredPending,
    resolveActionLabel,
    rollKindFor,
    rollTypeForSegment,
    sendGameLogRoll,
    type GameLogIntent,
    type GameLogRoll,
} from "./gameLog";
import type { RollResult } from "./diceRoller";

vi.mock("@owlbear-rodeo/sdk", () => ({
    default: { broadcast: { sendMessage: vi.fn().mockResolvedValue(undefined) } },
}));

const intent = (over: Partial<GameLogIntent> = {}): GameLogIntent => ({
    action: "Scimitar", segmentKind: "attack", advantage: "normal", critArmed: false,
    formula: "1d20+4", hidden: false, ...over,
});

const basic = (over: Partial<RollResult> = {}): RollResult => ({
    total: 21, diceRolls: [{ sides: 20, rolls: [17] }], modifier: 4,
    isNat1: false, isNat20: false, keptRolls: [17], advantage: "normal",
    variant: "DEFAULT", formattedText: "", ...over,
});

describe("rollTypeForSegment", () => {
    it("maps renderer kinds onto schema types", () => {
        expect(rollTypeForSegment("attack")).toBe("attack");
        expect(rollTypeForSegment("damage")).toBe("damage");
        expect(rollTypeForSegment("check")).toBe("check");
        expect(rollTypeForSegment("save")).toBe("save");
        expect(rollTypeForSegment("dc")).toBe("check");
        expect(rollTypeForSegment("recharge")).toBe("recharge");
        expect(rollTypeForSegment("other")).toBe("other");
        expect(rollTypeForSegment(undefined)).toBe("other");
    });
});

describe("rollKindFor", () => {
    it("prefers critical for armed damage", () => {
        expect(rollKindFor("normal", "damage", true)).toBe("critical");
    });
    it("maps advantage and disadvantage", () => {
        expect(rollKindFor("adv", "attack", false)).toBe("advantage");
        expect(rollKindFor("dis", "save", false)).toBe("disadvantage");
        expect(rollKindFor("normal", "attack", false)).toBe("normal");
    });
});

describe("buildRollFromBasicResult", () => {
    it("marks the dropped die of an advantage roll inactive", () => {
        const result = basic({
            total: 21, modifier: 4, advantage: "adv", keptRolls: [17],
            diceRolls: [{ sides: 20, rolls: [17, 3] }],
        });
        expect(buildRollFromBasicResult(result, intent({ advantage: "adv", formula: "2d20kh1+4" }))).toEqual({
            type: "attack", kind: "advantage", formula: "2d20kh1+4", total: 21, constant: 4,
            dice: [{ faces: 20, count: 2, results: [{ value: 17, active: true }, { value: 3, active: false }], keep: { mode: "highest", count: 1 } }],
            outcome: null,
        });
    });

    it("keeps exactly one die active when both d20s tie", () => {
        const result = basic({ advantage: "adv", keptRolls: [12], diceRolls: [{ sides: 20, rolls: [12, 12] }] });
        const roll = buildRollFromBasicResult(result, intent({ advantage: "adv", formula: "2d20kh1+0" }));
        expect(roll.dice[0].results).toEqual([{ value: 12, active: true }, { value: 12, active: false }]);
    });

    it("keeps every die active for a normal multi-die roll", () => {
        const result = basic({ total: 9, modifier: 2, diceRolls: [{ sides: 6, rolls: [3, 4] }] });
        expect(buildRollFromBasicResult(result, intent({ segmentKind: "damage", formula: "2d6+2" })).dice)
            .toEqual([{ faces: 6, count: 2, results: [{ value: 3, active: true }, { value: 4, active: true }] }]);
    });

    it("reports crit and fumble outcomes from the kept d20", () => {
        const crit = basic({ total: 24, isNat20: true, keptRolls: [20], diceRolls: [{ sides: 20, rolls: [20] }] });
        const fumble = basic({ total: 5, isNat1: true, keptRolls: [1], diceRolls: [{ sides: 20, rolls: [1] }] });
        expect(buildRollFromBasicResult(crit, intent()).outcome).toBe("critical");
        expect(buildRollFromBasicResult(fumble, intent()).outcome).toBe("fumble");
    });

    it("uses the critical kind for armed crit damage", () => {
        const result = basic({ total: 17, modifier: 3, diceRolls: [{ sides: 6, rolls: [4, 4, 3, 3] }] });
        const roll = buildRollFromBasicResult(result, intent({ segmentKind: "damage", critArmed: true, formula: "4d6+3" }));
        expect(roll.kind).toBe("critical");
        expect(roll.dice[0].count).toBe(4);
    });
});

describe("buildRollFromDicePlusResult", () => {
    const attack = { totalValue: 21, groups: [{ diceType: "d20", dice: [{ value: 17, kept: true }, { value: 3, kept: false }] }] };

    it("translates a two-d20 advantage result", () => {
        expect(buildRollFromDicePlusResult(attack, intent({ advantage: "adv", formula: "2d20kh1+4" }))).toEqual({
            type: "attack", kind: "advantage", formula: "2d20kh1+4", total: 21, constant: 4,
            dice: [{ faces: 20, count: 2, results: [{ value: 17, active: true }, { value: 3, active: false }], keep: { mode: "highest", count: 1 } }],
            outcome: null,
        });
    });

    it("treats dice without a kept flag as active", () => {
        const roll = buildRollFromDicePlusResult(
            { totalValue: 7, groups: [{ diceType: "d6", dice: [{ value: 5 }] }] },
            intent({ segmentKind: "damage", formula: "1d6+2" }),
        );
        expect(roll?.dice[0].results).toEqual([{ value: 5, active: true }]);
    });

    it("falls back to active dice plus the constant when totalValue is missing", () => {
        const roll = buildRollFromDicePlusResult(
            { groups: [{ diceType: "d6", dice: [{ value: 5, kept: true }] }] },
            intent({ segmentKind: "damage", formula: "1d6+2" }),
        );
        expect(roll?.total).toBe(7);
        expect(roll?.constant).toBe(2);
    });

    it("reports a natural 20 on a single d20", () => {
        const roll = buildRollFromDicePlusResult(
            { totalValue: 24, groups: [{ diceType: "d20", dice: [{ value: 20, kept: true }] }] },
            intent({ formula: "1d20+4" }),
        );
        expect(roll?.outcome).toBe("critical");
    });

    it("returns null when Dice+ sent no dice", () => {
        expect(buildRollFromDicePlusResult({ totalValue: 4 }, intent())).toBeNull();
        expect(buildRollFromDicePlusResult({ groups: [] }, intent())).toBeNull();
    });
});

describe("buildGameLogPayload", () => {
    const entity = { id: "token-1", type: "monster" as const, name: "Goblin" };
    const roll = buildRollFromBasicResult(basic(), intent());

    it("builds a v1 payload for the ddb channel", () => {
        const payload = buildGameLogPayload({ rollId: "roll_1", entity, intent: intent(), rolls: [roll] });
        expect(payload).toMatchObject({
            v: 1, rollId: "roll_1", via: "5e Tools",
            entity: { id: "token-1", type: "monster", name: "Goblin" },
            action: "Scimitar", rolls: [roll],
        });
        expect(payload?.hidden).toBeUndefined();
    });

    it("marks private rolls hidden", () => {
        const payload = buildGameLogPayload({ rollId: "r", entity, intent: intent({ hidden: true }), rolls: [roll] });
        expect(payload?.hidden).toBe(true);
    });

    it("truncates action and entity name to the schema limits", () => {
        const payload = buildGameLogPayload({
            rollId: "r",
            entity: { ...entity, name: "n".repeat(300) },
            intent: intent({ action: "a".repeat(300) }),
            rolls: [roll],
        });
        expect(payload?.action).toHaveLength(256);
        expect(payload?.entity.name).toHaveLength(128);
    });

    it("drops an oversized payload entirely", () => {
        const big: GameLogRoll = { ...roll, dice: [{ faces: 6, count: 4000, results: Array.from({ length: 4000 }, () => ({ value: 3, active: true })) }] };
        expect(buildGameLogPayload({ rollId: "r", entity, intent: intent(), rolls: [big] })).toBeNull();
    });

    it("returns null when there are no rolls", () => {
        expect(buildGameLogPayload({ rollId: "r", entity, intent: intent(), rolls: [] })).toBeNull();
    });
});

describe("isExpiredPending", () => {
    it("expires entries older than the ttl", () => {
        expect(isExpiredPending({ at: 1_000 }, 32_000)).toBe(true);
        expect(isExpiredPending({ at: 1_000 }, 31_000)).toBe(false);
        expect(isExpiredPending({ at: 0 }, 5_000, 1_000)).toBe(true);
    });
});

describe("sendGameLogRoll", () => {
    it("broadcasts to the local ddb channel", async () => {
        const payload = buildGameLogPayload({ rollId: "r", entity: { id: "t", type: "monster", name: "Goblin" }, intent: intent(), rolls: [buildRollFromBasicResult(basic(), intent())] })!;
        await sendGameLogRoll(payload);
        expect(OBR.broadcast.sendMessage).toHaveBeenCalledWith("com.ddbgamelog/api/roll", payload, { destination: "LOCAL" });
    });

    it("swallows broadcast failures", async () => {
        (OBR.broadcast.sendMessage as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("down"));
        await expect(sendGameLogRoll({} as never)).resolves.toBe(false);
    });
});

describe("resolveActionLabel", () => {
    it("prefers the owning action name over the button label", () => {
        expect(resolveActionLabel("Scimitar", "Attack Roll")).toBe("Scimitar");
        expect(resolveActionLabel("Fireball", "Roll")).toBe("Fireball");
    });

    it("strips 5e.tools markup from spell and ability names", () => {
        expect(resolveActionLabel("{@spell fire bolt|PHB}", "Attack Roll")).toBe("fire bolt");
        expect(resolveActionLabel("{@atk mw} {@hit 5}", "Attack Roll")).toBe("Melee Weapon Attack: +5");
    });

    it("trims surrounding whitespace", () => {
        expect(resolveActionLabel("  STR Check  ")).toBe("STR Check");
    });

    it("falls back to the button label when there is no action name", () => {
        expect(resolveActionLabel(undefined, "Attack Roll")).toBe("Attack Roll");
        expect(resolveActionLabel("   ", "DC 15 Check")).toBe("DC 15 Check");
    });

    it("falls back to Roll when nothing is available", () => {
        expect(resolveActionLabel(undefined)).toBe("Roll");
        expect(resolveActionLabel("", "")).toBe("Roll");
    });
});
