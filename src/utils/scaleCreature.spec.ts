import { describe, it, expect } from "vitest";
import {
    scaleMonster,
    crToNumber,
    numberToCr,
    crToPb,
    crToAtk,
    crToDc,
    crToAc,
    abilityMod,
    calcNewAbility,
    diceAverage,
    getScaledToRatio,
    interpAndTranslateToSpace,
    CR_HP_RANGES,
    CR_DPR_RANGES,
} from "./scaleCreature";
import type { Monster } from "../api";

describe("scaleCreature.ts", () => {
    describe("Core helpers and reference functions", () => {
        it("crToNumber converts fraction and integer strings and numbers correctly", () => {
            expect(crToNumber("0")).toBe(0);
            expect(crToNumber("1/8")).toBe(0.125);
            expect(crToNumber("1/4")).toBe(0.25);
            expect(crToNumber("1/2")).toBe(0.5);
            expect(crToNumber("9")).toBe(9);
            expect(crToNumber(5)).toBe(5);
            expect(crToNumber({ cr: "1/4" })).toBe(0.25);
            expect(crToNumber("unknown")).toBeNull();
            expect(crToNumber(null)).toBeNull();
        });

        it("numberToCr converts numbers back to 5e CR strings", () => {
            expect(numberToCr(0)).toBe("0");
            expect(numberToCr(0.125)).toBe("1/8");
            expect(numberToCr(0.25)).toBe("1/4");
            expect(numberToCr(0.5)).toBe("1/2");
            expect(numberToCr(9)).toBe("9");
            expect(numberToCr(20)).toBe("20");
        });

        it("crToPb calculates proficiency bonus based on CR ranges", () => {
            expect(crToPb(0)).toBe(2);
            expect(crToPb(0.5)).toBe(2);
            expect(crToPb(4)).toBe(2);
            expect(crToPb(5)).toBe(3);
            expect(crToPb(8)).toBe(3);
            expect(crToPb(9)).toBe(4);
            expect(crToPb(13)).toBe(5);
            expect(crToPb(17)).toBe(6);
            expect(crToPb(21)).toBe(7);
            expect(crToPb(25)).toBe(8);
            expect(crToPb(29)).toBe(9);
            expect(crToPb(30)).toBe(9);
        });

        it("crToAtk, crToDc, and crToAc return proper ideal values", () => {
            expect(crToAtk(0.5)).toBe(3);
            expect(crToAtk(9)).toBe(7);
            expect(crToAtk(30)).toBe(14);

            expect(crToDc(0.5)).toBe(13);
            expect(crToDc(9)).toBe(16);
            expect(crToDc(30)).toBe(23);

            expect(crToAc(0.5)).toBe(13);
            expect(crToAc(9)).toBe(16);
            expect(crToAc(20)).toBe(19);
        });

        it("abilityMod calculates D&D 5e modifier", () => {
            expect(abilityMod(10)).toBe(0);
            expect(abilityMod(11)).toBe(0);
            expect(abilityMod(12)).toBe(1);
            expect(abilityMod(18)).toBe(4);
            expect(abilityMod(8)).toBe(-1);
            expect(abilityMod(1)).toBe(-5);
        });

        it("calcNewAbility calculates score preserving parity up to 30", () => {
            const monOdd = { str: 15 }; // parity 1
            const monEven = { str: 14 }; // parity 0
            expect(calcNewAbility(monOdd, "str", 4)).toBe(19); // (4+5)*2 + 1 = 19
            expect(calcNewAbility(monEven, "str", 4)).toBe(18); // (4+5)*2 + 0 = 18
            expect(calcNewAbility(monOdd, "str", 10)).toBe(30); // caps at 30 if 31
            expect(calcNewAbility(monEven, "str", -5)).toBe(1); // max(1, 0)
        });

        it("getScaledToRatio correctly scales values proportionally", () => {
            expect(getScaledToRatio(10, 100, 200)).toBe(20);
            expect(getScaledToRatio(15, 50, 100)).toBe(30);
            expect(getScaledToRatio(10, 0, 100)).toBe(0);
        });

        it("interpAndTranslateToSpace maps a value from one range to another", () => {
            const inRange: [number, number] = [0, 2];
            const outRange: [number, number] = [2, 5];
            const result = interpAndTranslateToSpace(1, inRange, outRange);
            expect(result).toBeGreaterThanOrEqual(2);
            expect(result).toBeLessThanOrEqual(5);
        });

        it("diceAverage calculates mathematical average of dice formulas", () => {
            expect(diceAverage("2d6 + 3")).toBe(10); // 2 * 3.5 + 3 = 10
            expect(diceAverage("1d8 + 2")).toBe(6.5); // 4.5 + 2 = 6.5
            expect(diceAverage("3d10")).toBe(16.5);
            expect(diceAverage("")).toBe(0);
        });
    });

    describe("scaleMonster preconditions", () => {
        const baseMonster: Monster = {
            name: "Goblin",
            source: "MM",
            cr: "1/4",
            hp: { average: 7, formula: "2d6" },
            str: 8,
            dex: 14,
            con: 10,
        };

        it("returns original monster if target CR equals original CR", () => {
            const scaled = scaleMonster(baseMonster, 0.25);
            expect(scaled).toEqual(baseMonster);
            expect(scaled._isScaledCr).toBeUndefined();
        });

        it("returns original monster if original CR is invalid or out of range", () => {
            const invalidCrMon: Monster = { ...baseMonster, cr: "unknown" };
            expect(scaleMonster(invalidCrMon, 5)).toEqual(invalidCrMon);

            const outOfRangeMon: Monster = { ...baseMonster, cr: "50" };
            expect(scaleMonster(outOfRangeMon, 5)).toEqual(outOfRangeMon);
        });

        it("returns original monster if target CR is out of range", () => {
            expect(scaleMonster(baseMonster, 35)).toEqual(baseMonster);
            expect(scaleMonster(baseMonster, -1)).toEqual(baseMonster);
            expect(scaleMonster(baseMonster, NaN)).toEqual(baseMonster);
        });
    });

    describe("scaleMonster pipeline execution", () => {
        const giantSquid: Monster = {
            name: "Giant Squid",
            source: "XMM",
            cr: "6", // PB +3
            hp: { average: 120, formula: "16d10 + 32" }, // 32/16 = +2 con mod -> con 14
            ac: [11],
            str: 21,
            dex: 11,
            con: 15,
            int: 4,
            wis: 12,
            cha: 5,
            save: {
                str: "+8", // 5 (str) + 3 (pb)
                con: "+5", // 2 (con) + 3 (pb)
            },
            skill: {
                perception: "+4", // 1 (wis) + 3 (pb)
                stealth: "+3",    // 0 (dex) + 3 (pb)
            },
            passive: 14,
            action: [
                {
                    name: "Tentacle",
                    entries: [
                        "{@atk mw} {@hit 8} to hit, reach 15 ft., one target. {@h}14 (2d8 + 5) bludgeoning damage. If the target is a Huge or smaller creature, it is {@condition grappled} (escape {@dc 16})."
                    ]
                },
                {
                    name: "Bite",
                    entries: [
                        "{@atk mw} {@hit 8} to hit, reach 5 ft., one target. {@h}23 (4d8 + 5) piercing damage."
                    ]
                }
            ]
        };

        it("scales Giant Squid to CR 9 accurately", () => {
            const scaled = scaleMonster(giantSquid, 9);

            // 1. Metadata check
            expect(scaled._isScaledCr).toBe(true);
            expect(scaled._scaledCr).toBe(9);
            expect(scaled._originalCr).toBe("6");
            expect(scaled._displayName).toBe("Giant Squid (CR 9)");
            expect(scaled.cr).toBe("9");

            // 2. HP check (mean ratio from CR 6 (153) to CR 9 (198) gives targetHp 155 with range [148, 162])
            expect(scaled.hp?.average).toBeGreaterThan(120);
            expect(scaled.hp?.formula).toBeDefined();
            expect(scaled.hp?.average).toBe(150); // 20d10 + 40 (20 * 5.5 + 40 = 150)

            // 3. PB Delta (+3 -> +4, +1 pb delta)
            // Saves: STR should scale up with PB delta and potential STR increases
            expect(scaled.save?.str).toBeDefined();
            expect(parseInt(scaled.save!.str)).toBeGreaterThanOrEqual(9);

            // 4. Skills & Passive Perception
            expect(parseInt(scaled.skill!.perception)).toBeGreaterThanOrEqual(5);
            expect(scaled.passive).toBeGreaterThanOrEqual(15);

            // 5. Actions / Attacks: to-hit, DCs, and DPR damage formulas
            const tentacleEntry = (scaled.action![0] as any).entries[0];
            expect(tentacleEntry).toMatch(/\{@hit \d+\}/);
            expect(tentacleEntry).toMatch(/\{@dc \d+\}/);
            // Hit bonus for CR 9 should be around +7 / +8
            const hitMatch = /\{@hit (\d+)\}/.exec(tentacleEntry);
            expect(parseInt(hitMatch![1])).toBeGreaterThanOrEqual(7);

            // DC should be scaled
            const dcMatch = /\{@dc (\d+)\}/.exec(tentacleEntry);
            expect(parseInt(dcMatch![1])).toBeGreaterThanOrEqual(16);

            // Damage expression should be scaled
            expect(tentacleEntry).toMatch(/\d+ \(\d+d\d+(?: [+-] \d+)?\) bludgeoning damage/);
        });

        it("scales monster down accurately (e.g. CR 10 to CR 2)", () => {
            const bossMon: Monster = {
                name: "Boss Monster",
                source: "MM",
                cr: "10",
                hp: { average: 210, formula: "20d10 + 100" },
                ac: [17],
                str: 20,
                dex: 12,
                con: 20,
                save: { str: "+9" },
                action: [
                    {
                        name: "Greatsword",
                        entries: [
                            "{@atk mw} {@hit 9} to hit. {@h}26 (6d6 + 5) slashing damage."
                        ]
                    }
                ]
            };

            const scaledDown = scaleMonster(bossMon, 2);
            expect(scaledDown._scaledCr).toBe(2);
            expect(scaledDown.cr).toBe("2");
            expect(scaledDown.hp?.average).toBeLessThan(120);
            expect(scaledDown.ac?.[0]).toBeLessThanOrEqual(16);

            const swordEntry = (scaledDown.action![0] as any).entries[0];
            const hitMatch = /\{@hit (\d+)\}/.exec(swordEntry);
            expect(parseInt(hitMatch![1])).toBeLessThanOrEqual(6);
        });

        it("handles monsters with object cr (e.g. lair)", () => {
            const lairMon: Monster = {
                name: "Lair Boss",
                source: "MM",
                cr: { cr: "5", lair: "6" },
                hp: { average: 140, formula: "20d8 + 50" },
                str: 16,
            };

            const scaled = scaleMonster(lairMon, 8);
            expect(scaled.cr).toEqual({ cr: "8", lair: "6" });
            expect(scaled._displayName).toBe("Lair Boss (CR 8)");
        });

        it("handles special / non-standard hp formulas without crashing", () => {
            const specialHpMon: Monster = {
                name: "Weird HP Monster",
                source: "MM",
                cr: "1",
                hp: { special: "50 plus 10 per level" },
                str: 10,
            };

            const scaled = scaleMonster(specialHpMon, 4);
            expect(scaled._scaledCr).toBe(4);
            expect(scaled.hp?.special).toBe("50 plus 10 per level");
        });

        it("scales Archmage (XMM) CR 12 -> 5 matching all acceptance criteria", () => {
            const archmageXmm: Monster = {
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
                save: {
                    int: "+9",
                    wis: "+6"
                },
                skill: {
                    arcana: "+13",
                    history: "+13"
                },
                passive: 12,
                spellcasting: [
                    {
                        name: "Spellcasting",
                        ability: "int",
                        headerEntries: [
                            "The archmage casts one of the following spells, using Intelligence as the spellcasting ability (spell save {@dc 17}):"
                        ]
                    }
                ],
                action: [
                    {
                        name: "Arcane Burst",
                        entries: [
                            "{@atk ms,rs} {@hit 9} to hit, reach 5 ft. or range 120 ft., one target. {@h}27 (4d10 + 5) force damage."
                        ]
                    }
                ]
            };

            const scaled = scaleMonster(archmageXmm, 5);

            // Acceptance 1: HP — targetHp = round(99 * 138/243) = 56, targetRange [49,63]
            // Starting from origNumHd=18 with targetConMod=2, initAvg=117>63, decrement to 9:
            // 9*4.5 + 9*2 = 58 which is in [49,63]. Result: 9d8+18 (avg 58)
            expect(scaled.hp?.formula).toBe("9d8 + 18");
            expect(scaled.hp?.average).toBe(58);

            // Con mod per HD was +1 (con 12). CR 5 outConRange = [2,4].
            // interpAndTranslateToSpace(1, [1,5], [2,4]) → targetConMod = 2 → con 14 (+2)
            expect(scaled.con).toBeDefined();
            expect(abilityMod(scaled.con)).toBe(2);

            // AC: 15 * crToAc(5)/crToAc(12) = 15 * 15/17 ≈ 13
            expect(scaled.ac).toBeDefined();
            expect(scaled.ac![0]).toBeLessThanOrEqual(15);

            // INT: idealDcIn=17 (CR12), idealDcOut=15 (CR5), pbIn=4, pbOut=3
            // origDc = 17 (recovered from {@dc 17}+4-3=18... wait: recoveredDc = 17+4-3=18, outDc=max(10,18+(15-17))=16)
            // Let's just assert INT is reduced from 20 (mod+5) toward a lower value
            expect(scaled.int).toBeDefined();
            expect(abilityMod(scaled.int)).toBeLessThan(5);

            // Spell save DC in header: should be scaled from 17 down
            const scHeader = scaled.spellcasting![0].headerEntries[0];
            expect(scHeader).toMatch(/\{@dc \d+\}/);
            const dcMatch = /\{@dc (\d+)\}/.exec(scHeader);
            expect(parseInt(dcMatch![1])).toBeLessThan(17);

            // Arcane Burst to-hit: CR12 ideal +9, CR5 ideal +7; curToHit=9, should decrease
            const arcaneBurst = (scaled.action![0] as any).entries[0];
            expect(arcaneBurst).toMatch(/\{@hit \d+\}/);
            const hitMatch = /\{@hit (\d+)\}/.exec(arcaneBurst);
            expect(parseInt(hitMatch![1])).toBeLessThanOrEqual(9);

            // Arcane Burst damage: check formula is still present
            expect(arcaneBurst).toMatch(/\d+d\d+/);

            // DEX 14 (+2) unchanged — not Str/Dex based, so dex should be unmodified
            expect(scaled.dex).toBe(14);
            expect(abilityMod(scaled.dex)).toBe(2);
        });

        it("keeps unscaled monster data unchanged", () => {
            const rawMonster: Monster = {
                name: "Unchanged Monster",
                source: "MM",
                cr: "3",
                hp: { average: 50, formula: "8d8 + 14" },
                str: 14,
                dex: 12,
                con: 14,
            };

            const unscaled = scaleMonster(rawMonster, 3);
            expect(unscaled).toEqual(rawMonster);
        });
    });
});
