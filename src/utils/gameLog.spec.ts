import { describe, expect, it } from "vitest";
import { buildRollFromBasicResult, rollKindFor, rollTypeForSegment, type GameLogIntent } from "./gameLog";
import type { RollResult } from "./diceRoller";

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
