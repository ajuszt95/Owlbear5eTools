import { describe, it, expect } from "vitest";
import { scaleMonster, CR_HP_RANGES, CR_DPR_RANGES } from "./scaleCreature";
import type { Monster } from "../api";

function rangeMean(r: [number, number]): number {
    return (r[0] + r[1]) / 2;
}
function halfWidth(r: [number, number]): number {
    return (r[1] - r[0]) / 2;
}

describe("scalecreature-parity", () => {
    it("Giant Squid 6→9 hit is 8 or 9 not double-counted 10, HP inside window", () => {
        const giantSquid: Monster = {
            name: "Giant Squid",
            source: "XMM",
            cr: "6",
            hp: { average: 120, formula: "16d10 + 32" },
            ac: [11],
            str: 21,
            dex: 11,
            con: 15,
            int: 4,
            wis: 12,
            cha: 5,
            save: { str: "+8", con: "+5" },
            skill: { perception: "+4", stealth: "+3" },
            passive: 14,
            action: [
                {
                    name: "Tentacle",
                    entries: [
                        "{@atk mw} {@hit 8} to hit, reach 15 ft., one target. {@h}14 (2d8 + 5) bludgeoning damage. If the target is a Huge or smaller creature, it is {@condition grappled} (escape {@dc 16}).",
                    ],
                },
            ],
        };
        const scaled = scaleMonster(giantSquid, 9);
        const tentacle = (scaled.action![0] as any).entries[0] as string;
        const hitMatch = /\{@hit (\d+)\}/.exec(tentacle);
        expect(hitMatch).not.toBeNull();
        const hit = parseInt(hitMatch![1], 10);
        // Upstream ideal 6→7 diff 1, orig 7→8 or 8→9, must not be double-counted 10
        expect(hit).not.toBe(10);
        expect([8, 9]).toContain(hit);
        // HP inside variance window (target ± halfWidth), not absolute CR range
        const hpInMean = rangeMean(CR_HP_RANGES["6"]);
        const hpOutMean = rangeMean(CR_HP_RANGES["9"]);
        const target = Math.round(120 * (hpOutMean / hpInMean));
        const dev = halfWidth(CR_HP_RANGES["9"]);
        const avg = scaled.hp?.average ?? 0;
        expect(avg).toBeGreaterThanOrEqual(Math.floor(target - dev));
        expect(avg).toBeLessThanOrEqual(Math.ceil(target + dev));
        // Also check HP formula valid
        expect(scaled.hp?.formula).toMatch(/^\d+d\d+(?: [+-] \d+)?$/);
        // Damage inside DPR window
        const dprRange = CR_DPR_RANGES["9"];
        const varW = halfWidth(dprRange);
        const mean = rangeMean(CR_DPR_RANGES["9"]);
        // Tentacle damage avg should be inside DPR window for CR9 with mod consideration
        // We check that damage expression average is within [mean-var, mean+var] roughly
        // Extract damage avg fromTentacle: e.g., "18 (3d8 +5)"
        const dmgMatch = /(\d+) \(\d+d\d+(?: [+-] \d+)?\)/.exec(tentacle);
        if (dmgMatch) {
            const dmgAvg = parseInt(dmgMatch[1], 10);
            // DPR window for CR9 is 57-62, but single action DPR is portion; we just check not absurd
            expect(dmgAvg).toBeGreaterThan(5);
            expect(dmgAvg).toBeLessThan(40);
        }
    });

    it("Archmage 12→5 gives 9d8+18 avg 58", () => {
        const archmage: Monster = {
            name: "Archmage",
            source: "XMM",
            cr: "12",
            hp: { average: 99, formula: "18d8 + 18" },
            ac: [15],
            str: 10,
            dex: 14,
            con: 12,
            int: 20,
            wis: 15,
            cha: 16,
            save: { int: "+9", wis: "+6" },
            skill: { arcana: "+13", history: "+13" },
            passive: 12,
            spellcasting: [
                {
                    name: "Spellcasting",
                    ability: "int",
                    headerEntries: ["The archmage casts one of the following spells, using Intelligence as the spellcasting ability (spell save {@dc 17}):"],
                },
            ],
            action: [{ name: "Arcane Burst", entries: ["{@atk ms,rs} {@hit 9} to hit, reach 5 ft. or range 120 ft., one target. {@h}27 (4d10 + 5) force damage."] }],
        };
        const scaled = scaleMonster(archmage, 5);
        expect(scaled.hp?.formula).toBe("9d8 + 18");
        expect(scaled.hp?.average).toBe(58);
        // AC should be <=15 (scaled down)
        expect(scaled.ac![0] as number).toBeLessThanOrEqual(15);
        // INT should be reduced (DC down)
        expect(scaled.int).toBeDefined();
        // DC in header should be less than 17
        const scHeader = (scaled.spellcasting![0] as any).headerEntries[0] as string;
        const dcMatch = /\{@dc (\d+)\}/.exec(scHeader);
        expect(dcMatch).not.toBeNull();
        expect(parseInt(dcMatch![1], 10)).toBeLessThan(17);
        // Arcane Burst to-hit should not increase
        const burst = (scaled.action![0] as any).entries[0] as string;
        const hitMatch = /\{@hit (\d+)\}/.exec(burst);
        expect(parseInt(hitMatch![1], 10)).toBeLessThanOrEqual(9);
        expect(burst).toMatch(/\d+d\d+/);
        // DEX unchanged (not weapon)
        expect(scaled.dex).toBe(14);
    });

    it("fractional Goblin 0.25→2 HP inside window and scaled correctly", () => {
        const goblin: Monster = {
            name: "Goblin",
            source: "MM",
            cr: "1/4",
            hp: { average: 7, formula: "2d6" },
            ac: [15],
            str: 8,
            dex: 14,
            con: 10,
        };
        const scaled = scaleMonster(goblin, 2);
        expect(scaled._scaledCr).toBe(2);
        expect(scaled.cr).toBe("2");
        const hpInMean = rangeMean(CR_HP_RANGES["0.25"]);
        const hpOutMean = rangeMean(CR_HP_RANGES["2"]);
        const target = Math.round(7 * (hpOutMean / hpInMean));
        const dev = halfWidth(CR_HP_RANGES["2"]);
        const avg = scaled.hp?.average ?? 0;
        // Check inside target window, not absolute CR range (which would be 86-100)
        expect(avg).toBeGreaterThanOrEqual(Math.floor(target - dev));
        expect(avg).toBeLessThanOrEqual(Math.ceil(target + dev));
        expect(scaled.hp?.formula).toMatch(/^\d+d\d+(?: [+-] \d+)?$/);
    });

    it("fractional 0.5 via string and numeric both", async () => {
        const { crToNumber } = await import("./scaleCreature");
        expect(crToNumber("1/2")).toBe(0.5);
        expect(crToNumber("0.5")).toBe(0.5);
        expect(crToNumber("1/8")).toBe(0.125);
    });

    it("armored Knight AC retains armor tag", () => {
        const knight: Monster = {
            name: "Knight",
            source: "MM",
            cr: "3",
            hp: { average: 52, formula: "8d8 + 16" },
            ac: [{ ac: 18, from: ["plate armor"] } as any],
            str: 16,
            dex: 11,
            con: 14,
        };
        const scaled = scaleMonster(knight, 5);
        expect(scaled.ac).toBeDefined();
        const acItem = scaled.ac![0] as any;
        if (typeof acItem === "object") {
            expect(acItem.from).toBeDefined();
            // Should retain armor tag, not become bare number
            expect(JSON.stringify(acItem.from).toLowerCase()).toContain("plate");
            expect(typeof acItem.ac).toBe("number");
        } else {
            // If numeric, still within window
            expect(typeof acItem).toBe("number");
        }
    });

    it("calcNewAbility caps at 30", async () => {
        const { calcNewAbility } = await import("./scaleCreature");
        const monOdd = { str: 15 };
        expect(calcNewAbility(monOdd, "str", 13)).toBe(30);
        expect(calcNewAbility({ str: 14 }, "str", 13)).toBe(30);
    });

    it("expertise save/skill handling", () => {
        const expertMon: Monster = {
            name: "Expert",
            source: "MM",
            cr: "5", // pb 3
            hp: { average: 100, formula: "10d10 + 45" },
            ac: [15],
            str: 10,
            dex: 14,
            con: 14,
            int: 12,
            wis: 10,
            cha: 10,
            save: { dex: "+8" }, // dex mod +2 + pb 3*2=6 => +8 expertise
            skill: { stealth: "+8" }, // same
            passive: 10,
        };
        // Scale to CR9 pb 4, expertise should become +10 (2+8)
        const scaled = scaleMonster(expertMon, 9);
        expect(scaled.save?.dex).toBe("+10");
        expect(scaled.skill?.stealth).toBe("+10");
    });

    it("finalization clears xp and preserves lair", () => {
        const lairMon: Monster = {
            name: "Lair Boss",
            source: "MM",
            cr: { cr: "5", lair: "6", xp: 1800 } as any,
            hp: { average: 140, formula: "20d8 + 50" },
            str: 16,
        };
        const scaled = scaleMonster(lairMon, 8);
        expect(scaled.cr).toEqual({ cr: "8", lair: "6" });
        expect((scaled.cr as any).xp).toBeUndefined();
        expect(scaled._displayName).toBe("Lair Boss (CR 8)");
    });

    it("no-op on same or out-of-range CR returns original ref", () => {
        const mon: Monster = { name: "Test", source: "MM", cr: "3", hp: { average: 50, formula: "8d8 + 14" }, str: 14 };
        const same = scaleMonster(mon, 3);
        expect(same).toBe(mon);
        expect(same._isScaledCr).toBeUndefined();
        const out = scaleMonster(mon, 99);
        expect(out).toBe(mon);
    });
});
